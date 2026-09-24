import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';

export interface CategoryBreakdown {
  skills: number; // 0 - 100 (45% weight)
  experience: number; // 0 - 100 (25% weight)
  education: number; // 0 - 100 (15% weight)
  formatting: number; // 0 - 100 (15% weight)
}

export interface ATSAnalysisResult {
  overall_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: string[];
  breakdown: CategoryBreakdown;
  mode?: 'ai' | 'heuristic';
}

export interface AnalyzeResumeParams {
  resumeText?: string;
  jobDescription?: string;
}

export class AnalyzerError extends Error {
  status: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'AnalyzerError';
    this.status = status;
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// =========================================================================
// STAGE 1: EXTRACTION SCHEMAS & PROMPTS
// =========================================================================

interface ResumeExtraction {
  skills: string[];
  experience: Array<{
    role: string;
    years?: number;
    highlights: string[];
  }>;
  total_years_experience?: number;
  education: string[];
  certifications: string[];
}

interface JobDescriptionExtraction {
  must_have_skills: string[];
  nice_to_have: string[];
  min_years: number;
  education_required: string[];
}

// In-memory extraction caches keyed by SHA-256 hash of document text
export const resumeExtractionCache = new Map<string, ResumeExtraction>();
export const jobExtractionCache = new Map<string, JobDescriptionExtraction>();

export function hashText(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

const RESUME_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Technical skills, tools, programming languages, databases, and frameworks explicitly listed in the resume',
    },
    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING },
          years: { type: Type.NUMBER, description: 'Duration in years' },
          highlights: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Key bullet points, accomplishments, and metrics',
          },
        },
        required: ['role', 'highlights'],
      },
      description: 'Work history roles and accomplishments',
    },
    total_years_experience: {
      type: Type.NUMBER,
      description: 'Estimated total years of professional software/industry experience',
    },
    education: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Degrees, majors, universities',
    },
    certifications: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Professional licenses or certifications',
    },
  },
  required: ['skills', 'experience', 'education', 'certifications'],
};

const JOB_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    must_have_skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Genuine primary required technical skills, languages, tools, frameworks, databases, or cloud platforms',
    },
    nice_to_have: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Preferred, bonus, or secondary technical skills',
    },
    min_years: {
      type: Type.NUMBER,
      description: 'Minimum required years of experience (e.g. 5 for 5+ years, 0 if not specified)',
    },
    education_required: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Required degrees or fields of study',
    },
  },
  required: ['must_have_skills', 'nice_to_have', 'min_years', 'education_required'],
};

const VERDICT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    suggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3 to 5 strict, actionable, recruiter recommendations grounded directly in the provided gap analysis and computed scores',
    },
  },
  required: ['suggestions'],
};

// Common Location, Address, Perk, and Boilerplate Noise Words to filter out of JD skills
const NOISE_FILTER_LIST = new Set([
  // Cities & Regions
  'san francisco', 'sf', 'austin', 'new york', 'nyc', 'seattle', 'boston', 'chicago',
  'los angeles', 'la', 'denver', 'atlanta', 'san jose', 'sunnyvale', 'palo alto',
  'california', 'texas', 'washington', 'new york city', 'london', 'toronto', 'vancouver',
  'united states', 'usa', 'remote', 'hybrid', 'on-site', 'onsite', 'hq', 'headquarters',
  'relocation', 'travel',
  // Company / Office boilerplate
  'equal opportunity', 'eeo', 'affirmative action', 'diversity', 'veteran', 'disability',
  'gender', 'race', 'religion', 'authorized to work', 'visa sponsorship', 'visa', 'w2', 'c2c',
  // Compensation & Perks
  'salary', 'competitive salary', 'equity', 'bonus', '401k', '401(k)', 'health insurance',
  'dental', 'vision', 'benefits', 'pto', 'unlimited pto', 'vacation', 'perks', 'stipend',
  'flexible hours', 'work-life balance',
  // Generic soft clichés
  'team player', 'fast learner', 'self-starter', 'work ethic', 'motivated', 'passionate',
  'go-getter', 'culture fit', 'rockstar', 'ninja', 'hard worker', 'good attitude'
]);

function filterNoiseSkills(rawSkills: string[]): string[] {
  return rawSkills
    .map((s) => s.trim())
    .filter((s) => {
      if (!s || s.length < 2 || s.length > 50) return false;
      const lower = s.toLowerCase();
      // Exclude exact matches in noise list
      if (NOISE_FILTER_LIST.has(lower)) return false;
      // Exclude strings containing address/location/benefits terms
      if (
        /\b(city|county|state|office|address|zip|street|avenue|blvd|suite|floor|salary|401k|healthcare|dental|equal opportunity|disability|veteran|sponsorship|relocation)\b/i.test(
          lower
        )
      ) {
        return false;
      }
      return true;
    });
}

// Canonical synonym normalization for fuzzy matching
const SYNONYM_CANONICAL_MAP: Record<string, string> = {
  'react': 'react',
  'reactjs': 'react',
  'react.js': 'react',
  'node': 'node.js',
  'nodejs': 'node.js',
  'node.js': 'node.js',
  'next': 'next.js',
  'nextjs': 'next.js',
  'next.js': 'next.js',
  'vue': 'vue.js',
  'vuejs': 'vue.js',
  'vue.js': 'vue.js',
  'angular': 'angular',
  'angularjs': 'angular',
  'angular.js': 'angular',
  'ts': 'typescript',
  'typescript': 'typescript',
  'js': 'javascript',
  'javascript': 'javascript',
  'ecmascript': 'javascript',
  'postgres': 'postgresql',
  'postgresql': 'postgresql',
  'psql': 'postgresql',
  'mongo': 'mongodb',
  'mongodb': 'mongodb',
  'k8s': 'kubernetes',
  'kubernetes': 'kubernetes',
  'docker': 'docker',
  'containerization': 'docker',
  'containers': 'docker',
  'aws': 'aws',
  'amazon web services': 'aws',
  'gcp': 'gcp',
  'google cloud': 'gcp',
  'google cloud platform': 'gcp',
  'azure': 'azure',
  'microsoft azure': 'azure',
  'golang': 'go',
  'go': 'go',
  'python': 'python',
  'python3': 'python',
  'ml': 'machine learning',
  'machine learning': 'machine learning',
  'ai': 'artificial intelligence',
  'artificial intelligence': 'artificial intelligence',
  'ci/cd': 'ci/cd',
  'cicd': 'ci/cd',
  'ci cd': 'ci/cd',
  'continuous integration': 'ci/cd',
  'rest': 'rest apis',
  'rest apis': 'rest apis',
  'restful': 'rest apis',
  'restful apis': 'rest apis',
  'graphql': 'graphql',
  'tailwind': 'tailwind css',
  'tailwindcss': 'tailwind css',
  'tailwind css': 'tailwind css',
  'html': 'html5',
  'html5': 'html5',
  'css': 'css3',
  'css3': 'css3',
  'redis': 'redis',
  'git': 'git',
  'github': 'github',
  'github actions': 'github actions',
  'microservices': 'microservices',
  'distributed systems': 'distributed systems',
  'agile': 'agile / scrum',
  'scrum': 'agile / scrum',
  'agile / scrum': 'agile / scrum',
  'system design': 'system design',
  'jest': 'jest',
  'playwright': 'playwright',
  'cypress': 'cypress',
  'automated testing': 'automated testing',
  'unit testing': 'unit testing',
};

function normalizeSkill(skill: string): string {
  const cleaned = skill
    .toLowerCase()
    .replace(/[^\w\s.+/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return SYNONYM_CANONICAL_MAP[cleaned] || cleaned;
}

// =========================================================================
// STAGE 2: MATCHING (PURE CODE, NO AI)
// =========================================================================

interface MatchResults {
  matchedKeywords: string[];
  missingKeywords: string[];
  skillMatchPct: number; // 0 - 100
  experienceFitPct: number; // 0 - 100
  educationFitPct: number; // 0 - 100
  readabilityPct: number; // 0 - 100
}

function runDeterministicMatching(
  resume: ResumeExtraction,
  jd: JobDescriptionExtraction,
  rawResumeText: string
): MatchResults {
  const resumeTextLower = rawResumeText.toLowerCase();

  // 1. Build canonical set of candidate skills from resume.skills and highlights
  const candidateCanonicalSkills = new Set<string>();
  const rawSkillsSet = new Set<string>();

  for (const skill of resume.skills || []) {
    const norm = normalizeSkill(skill);
    candidateCanonicalSkills.add(norm);
    rawSkillsSet.add(skill.toLowerCase());
  }

  // Also collect keywords from highlights & roles
  const highlightsText = (resume.experience || [])
    .flatMap((exp) => exp.highlights || [])
    .join(' ')
    .toLowerCase();

  const isPresentInResume = (jdSkill: string): boolean => {
    const normJd = normalizeSkill(jdSkill);
    if (candidateCanonicalSkills.has(normJd)) return true;

    // Check exact raw word in skills list
    const lowerJd = jdSkill.toLowerCase();
    if (rawSkillsSet.has(lowerJd)) return true;

    // Word boundary check in highlights or raw resume text
    const escaped = lowerJd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    if (regex.test(highlightsText) || regex.test(resumeTextLower)) {
      return true;
    }

    // Check canonical synonym in raw resume text
    if (normJd !== lowerJd) {
      const normEscaped = normJd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const normRegex = new RegExp(`(^|[^a-z0-9])${normEscaped}([^a-z0-9]|$)`, 'i');
      if (normRegex.test(resumeTextLower)) {
        return true;
      }
    }

    return false;
  };

  // 2. Evaluate Must-Have Skills and Nice-To-Have Skills
  const cleanMustHaves = filterNoiseSkills(jd.must_have_skills || []);
  const cleanNiceToHaves = filterNoiseSkills(jd.nice_to_have || []);

  const matchedSet = new Set<string>();
  const missingSet = new Set<string>();

  let mustHavesMatched = 0;
  for (const skill of cleanMustHaves) {
    if (isPresentInResume(skill)) {
      mustHavesMatched++;
      matchedSet.add(skill);
    } else {
      missingSet.add(skill);
    }
  }

  let niceToHavesMatched = 0;
  for (const skill of cleanNiceToHaves) {
    if (isPresentInResume(skill)) {
      niceToHavesMatched++;
      matchedSet.add(skill);
    } else {
      // Nice-to-haves only go to missing keywords if we have fewer than 8 missing items
      if (missingSet.size < 8) {
        missingSet.add(skill);
      }
    }
  }

  // Also check candidate skills that match common industry stack if must-haves was empty
  if (matchedSet.size === 0) {
    for (const skill of resume.skills || []) {
      if (resumeTextLower.includes(skill.toLowerCase())) {
        matchedSet.add(skill);
      }
    }
  }

  // 3. Compute skill_match_pct (0 - 100)
  let skillMatchPct = 70;
  const totalMustHaves = cleanMustHaves.length;
  if (totalMustHaves > 0) {
    const baseRatio = mustHavesMatched / totalMustHaves;
    const bonus = cleanNiceToHaves.length > 0 ? (niceToHavesMatched / cleanNiceToHaves.length) * 10 : 5;
    skillMatchPct = Math.round(Math.min(100, Math.max(20, baseRatio * 90 + bonus)));
  } else {
    // If JD didn't break down must-haves, compute ratio over all detected skills
    const totalSkills = matchedSet.size + missingSet.size;
    skillMatchPct = totalSkills > 0 ? Math.round((matchedSet.size / totalSkills) * 100) : 75;
  }

  // 4. Compute experience_fit (0 - 100)
  // Check candidate total years vs JD min_years
  let candidateYears = resume.total_years_experience || 0;
  if (!candidateYears && resume.experience?.length) {
    candidateYears = resume.experience.reduce((acc, curr) => acc + (curr.years || 2), 0);
  }
  if (!candidateYears) {
    const match = rawResumeText.match(/(\d+)\+?\s*years/i);
    candidateYears = match ? parseInt(match[1], 10) : 4;
  }

  const requiredYears = jd.min_years > 0 ? jd.min_years : 4;

  let experienceFitPct = 75;
  if (candidateYears >= requiredYears) {
    experienceFitPct = 85;
    if (candidateYears >= requiredYears + 2) experienceFitPct = 92;
  } else {
    experienceFitPct = Math.round(Math.max(30, (candidateYears / requiredYears) * 80));
  }

  // Check quantified impact metrics in resume highlights (e.g. 42%, 120k users, $2M)
  const metricMatches = rawResumeText.match(/\b\d+(\.\d+)?%|\$\d+|\b\d{2,}\+?\s*(users|daily|records|defects|minutes|min|latency|cycle|hours|million|billion|k\b)/gi) || [];
  if (metricMatches.length >= 4) {
    experienceFitPct = Math.min(100, experienceFitPct + 8);
  } else if (metricMatches.length >= 2) {
    experienceFitPct = Math.min(100, experienceFitPct + 4);
  }

  // 5. Compute education_fit (0 - 100)
  let educationFitPct = 70;
  const hasDegree = /b\.?s\.?|bachelor|master|m\.?s\.?|ph\.?d|computer science|engineering|software|information technology/i.test(
    rawResumeText
  );
  const hasCert = /certified|certification|aws certified|cloud practitioner|solutions architect/i.test(
    rawResumeText
  );

  if (hasDegree && hasCert) {
    educationFitPct = 95;
  } else if (hasDegree) {
    educationFitPct = 90;
  } else if (/associate|diploma|bootcamp/i.test(rawResumeText)) {
    educationFitPct = 75;
  }

  // 6. Compute ATS Readability & Formatting (0 - 100)
  let readabilityPct = 50;
  const hasSummary = /summary|profile|about/i.test(rawResumeText);
  const hasExperience = /experience|work history|employment/i.test(rawResumeText);
  const hasEducation = /education|university|college/i.test(rawResumeText);
  const hasSkills = /skills|competencies|technologies/i.test(rawResumeText);
  const sectionCount = [hasSummary, hasExperience, hasEducation, hasSkills].filter(Boolean).length;
  readabilityPct += sectionCount * 10; // up to +40

  // Action verbs check
  const actionVerbMatches = rawResumeText.match(/\b(architected|redesigned|delivered|established|mentored|developed|optimized|implemented|partnered|spearheaded|engineered|built|led|designed)\b/gi) || [];
  if (actionVerbMatches.length >= 4) {
    readabilityPct = Math.min(100, readabilityPct + 10);
  } else if (actionVerbMatches.length >= 2) {
    readabilityPct = Math.min(100, readabilityPct + 5);
  }

  return {
    matchedKeywords: Array.from(matchedSet).slice(0, 14),
    missingKeywords: Array.from(missingSet).slice(0, 10),
    skillMatchPct: Math.max(0, Math.min(100, skillMatchPct)),
    experienceFitPct: Math.max(0, Math.min(100, experienceFitPct)),
    educationFitPct: Math.max(0, Math.min(100, educationFitPct)),
    readabilityPct: Math.max(0, Math.min(100, readabilityPct)),
  };
}

// =========================================================================
// STAGE 3: SCORING (PURE CODE, DETERMINISTIC)
// overall_score = 45% skill_match + 25% experience_fit + 15% education_certifications + 15% ATS_readability
// =========================================================================

function computeDeterministicScore(matchResults: MatchResults): {
  overall_score: number;
  breakdown: CategoryBreakdown;
} {
  const breakdown: CategoryBreakdown = {
    skills: matchResults.skillMatchPct,
    experience: matchResults.experienceFitPct,
    education: matchResults.educationFitPct,
    formatting: matchResults.readabilityPct,
  };

  const weightedSum =
    0.45 * breakdown.skills +
    0.25 * breakdown.experience +
    0.15 * breakdown.education +
    0.15 * breakdown.formatting;

  const overall_score = Math.max(0, Math.min(100, Math.round(weightedSum)));

  return {
    overall_score,
    breakdown,
  };
}

// =========================================================================
// STAGE 4: VERDICT (ONE GEMINI CALL, TEMPERATURE 0.2)
// Receives ONLY computed numbers and match lists. Does NOT alter scores.
// =========================================================================

function buildVerdictPrompt(
  score: number,
  breakdown: CategoryBreakdown,
  matched: string[],
  missing: string[]
): string {
  return `You are a strict, seasoned corporate recruiter and elite ATS specialist.
The algorithmic evaluation of the candidate has ALREADY been computed and finalized.
You must NOT alter or recalculate any scores.

FINAL COMPUTED METRICS:
- Overall ATS Match Score: ${score}/100
- Category Breakdown:
  * Hard Skills Match (45% weight): ${breakdown.skills}/100
  * Experience & Seniority Fit (25% weight): ${breakdown.experience}/100
  * Education & Certifications (15% weight): ${breakdown.education}/100
  * ATS Readability & Structure (15% weight): ${breakdown.formatting}/100
- Top Matched Skills: ${matched.join(', ') || 'General engineering background'}
- Missing Job Requirements: ${missing.join(', ') || 'None prominent'}

TASK:
Generate 3 to 5 strict, prioritized, actionable recruiter suggestions in the direct voice of a hiring manager.
Guidelines:
1. Ground each recommendation in the candidate's exact gaps (${missing.slice(0, 4).join(', ') || 'core stack'}).
2. Cite concrete adjustments (e.g. weave missing skills into project bullets, quantify metrics with ROI/latency/scale, label standard ATS headers).
3. Do not include pleasantries. Return only the structured JSON.`;
}

function generateDeterministicSuggestions(
  score: number,
  missing: string[],
  breakdown: CategoryBreakdown
): string[] {
  const suggestions: string[] = [];

  if (missing.length > 0) {
    const topMissing = missing.slice(0, 3).join(', ');
    suggestions.push(
      `Explicitly weave high-priority job requirements (${topMissing}) into your core technical competencies and recent project bullet points.`
    );
  }

  if (breakdown.experience < 85) {
    suggestions.push(
      'Quantify your business impact — replace generic responsibilities with measurable outcomes (e.g., "reduced latency by 35%" or "scaled microservice to 100k+ daily users").'
    );
  } else {
    suggestions.push(
      'Elevate high-scale architectural ownership bullet points and leadership responsibilities to the top third of your most recent role.'
    );
  }

  suggestions.push(
    'Align your resume summary and job titles directly with the target role to pass initial algorithmic ATS filters before human recruiter review.'
  );

  if (breakdown.formatting < 85 || score < 75) {
    suggestions.push(
      'Ensure standard ATS section headers (Professional Summary, Experience, Technical Skills, Education) are formatted with clear date ranges and active action verbs.'
    );
  } else {
    suggestions.push(
      'Highlight domain-specific certifications or advanced cloud architecture competencies in your core skills section.'
    );
  }

  return suggestions.slice(0, 4);
}

// =========================================================================
// MAIN PIPELINE EXECUTION
// =========================================================================

export async function analyzeResume(params: AnalyzeResumeParams): Promise<ATSAnalysisResult> {
  const resumeText = params.resumeText;
  const jobDescription = params.jobDescription;

  if (!resumeText || typeof resumeText !== 'string' || resumeText.trim().length < 20) {
    throw new AnalyzerError('This looks like a scanned PDF — try a text-based version', 400);
  }

  if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length < 30) {
    throw new AnalyzerError(
      'Job description is too short. Please paste at least a few sentences or the full job requirements for an accurate ATS analysis.',
      400
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AnalyzerError(
      'Gemini API key is not configured. Please ensure GEMINI_API_KEY is provided in environment variables.',
      500
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Model configurations:
  // 1. Extraction stages (Resume & Job parsing): Strong models ONLY (gemini-3.8-flash, gemini-flash-latest).
  //    No silent downgrade to lite models. If strong models are unavailable/rate-limited, return a clean user error.
  const extractionModels = ['gemini-3.8-flash', 'gemini-flash-latest'];

  // 2. Verdict/suggestions stage: Generates actionable advice from pre-computed scores without affecting scoring.
  //    Can safely use fastest models including lite.
  const verdictModels = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];

  // Helper: Call Gemini model with strict timeout, fallback, and timing logs
  async function callGeminiWithTimeoutAndFallback<T>(
    stageName: string,
    modelList: string[],
    prompt: string,
    schema: any,
    timeoutMs: number = 8000
  ): Promise<{ data: T | null; modelServed: string; durationMs: number }> {
    for (const model of modelList) {
      const startTime = Date.now();
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeoutMs);

      try {
        console.log(`[ATS Timing] [${stageName}] Attempting model: ${model} (timeout: ${timeoutMs}ms)`);
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: schema,
            abortSignal: abortController.signal,
          },
        });
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;

        if (res?.text) {
          const parsed = JSON.parse(res.text.trim());
          console.log(`[ATS Timing] [${stageName}] SUCCESS with model: ${model} in ${durationMs}ms`);
          return { data: parsed, modelServed: model, durationMs };
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;
        const isTimeout = abortController.signal.aborted || err?.name === 'AbortError' || err?.message?.includes('aborted');
        const isRateLimit = err?.status === 'RESOURCE_EXHAUSTED' || err?.message?.includes('429') || err?.message?.includes('Quota exceeded');
        const isUnavailable = err?.status === 'UNAVAILABLE' || err?.message?.includes('503');

        console.warn(
          `[ATS Timing] [${stageName}] FAILED/TIMED OUT on model: ${model} after ${durationMs}ms ${
            isTimeout
              ? '(EXCEEDED 8s TIMEOUT - FALLING BACK)'
              : isRateLimit
              ? '(429 RATE LIMIT / QUOTA EXCEEDED - FALLING BACK)'
              : isUnavailable
              ? '(503 TEMPORARILY UNAVAILABLE - FALLING BACK)'
              : `(${err?.message || 'Error'})`
          }`
        );
      }
    }
    console.error(`[ATS Timing] [${stageName}] All strong extraction models exhausted`);
    return { data: null, modelServed: 'none (exhausted)', durationMs: 0 };
  }

  // -----------------------------------------------------------------------
  // STAGE 1 — EXTRACTION: Two Gemini calls (temperature 0.2)
  // Call 1: Resume extraction
  // Call 2: Job Description extraction with strict NOISE FILTER
  // Run in PARALLEL via Promise.all
  // -----------------------------------------------------------------------

  let extractedResume: ResumeExtraction | null = null;
  let extractedJob: JobDescriptionExtraction | null = null;

  const resumeExtractionPrompt = `Extract qualifications from this resume into strict JSON:
{
  "skills": ["string"],
  "experience": [{ "role": "string", "years": number, "highlights": ["string"] }],
  "total_years_experience": number,
  "education": ["string"],
  "certifications": ["string"]
}
Do NOT score or judge. Only extract what is present in the resume text.

RESUME TEXT:
"""
${resumeText.slice(0, 15000)}
"""`;

  const jobExtractionPrompt = `Extract genuine role requirements from this job description into strict JSON:
{
  "must_have_skills": ["string"],
  "nice_to_have": ["string"],
  "min_years": number,
  "education_required": ["string"]
}

STRICT NOISE FILTER RULES:
- "must_have_skills" and "nice_to_have" must contain ONLY genuine job requirements: technical skills, programming languages, libraries, frameworks, cloud services, databases, system architecture, engineering methodologies, and domain knowledge.
- STRICTLY EXCLUDE:
  1. Company names, team names, or client names.
  2. City names, states, countries, office addresses, zip codes, or location names (e.g. "San Francisco", "Austin", "New York", "Remote", "Hybrid", "United States", "HQ"). A location is NEVER a job skill or keyword requirement.
  3. Salary figures, 401(k), equity, benefits, healthcare, PTO, perks, work-life balance phrases.
  4. Working hours, shift schedules, travel requirements.
  5. Equal Opportunity Employer (EOE), DEI statements, legal disclaimers, visa sponsorship notes.
  6. Contact info, email addresses, phone numbers, website URLs, apply links.
  7. Generic conversational filler words or unspecific clichés (e.g. "team player", "passionate", "fast learner", "self-starter", "rockstar").
- Extraction only — no scoring or judgment.

JOB DESCRIPTION:
"""
${jobDescription.slice(0, 10000)}
"""`;

  // Run Stage 1 extraction in parallel (Promise.all) for fast performance
  const stage1Start = Date.now();
  console.log(`[ATS Timing] Starting Stage 1 Extractions (Parallel: Resume + Job Description)...`);

  const resumeHash = hashText(resumeText);
  const jobHash = hashText(jobDescription);

  const cachedResume = resumeExtractionCache.get(resumeHash);
  const cachedJob = jobExtractionCache.get(jobHash);

  let resumeCallPromise: Promise<{ data: ResumeExtraction | null; modelServed: string; durationMs: number }>;
  let jobCallPromise: Promise<{ data: JobDescriptionExtraction | null; modelServed: string; durationMs: number }>;

  if (cachedResume) {
    console.log(`[ATS Timing] [Resume Extraction] CACHE HIT (Hash: ${resumeHash.slice(0, 10)}...) — Reusing cached extraction`);
    resumeCallPromise = Promise.resolve({
      data: cachedResume,
      modelServed: 'cache (in-memory hash)',
      durationMs: 0,
    });
  } else {
    console.log(`[ATS Timing] [Resume Extraction] CACHE MISS — Calling strong model waterfall`);
    resumeCallPromise = callGeminiWithTimeoutAndFallback<ResumeExtraction>(
      'Resume Extraction',
      extractionModels,
      resumeExtractionPrompt,
      RESUME_EXTRACTION_SCHEMA,
      8000
    );
  }

  if (cachedJob) {
    console.log(`[ATS Timing] [Job Extraction] CACHE HIT (Hash: ${jobHash.slice(0, 10)}...) — Reusing cached extraction`);
    jobCallPromise = Promise.resolve({
      data: cachedJob,
      modelServed: 'cache (in-memory hash)',
      durationMs: 0,
    });
  } else {
    console.log(`[ATS Timing] [Job Extraction] CACHE MISS — Calling strong model waterfall`);
    jobCallPromise = callGeminiWithTimeoutAndFallback<JobDescriptionExtraction>(
      'Job Extraction',
      extractionModels,
      jobExtractionPrompt,
      JOB_EXTRACTION_SCHEMA,
      8000
    );
  }

  try {
    const [resumeCallResult, jobCallResult] = await Promise.all([resumeCallPromise, jobCallPromise]);

    extractedResume = resumeCallResult.data;
    extractedJob = jobCallResult.data;

    // Cache successful extractions
    if (extractedResume && !cachedResume) {
      resumeExtractionCache.set(resumeHash, extractedResume);
    }
    if (extractedJob && !cachedJob) {
      jobExtractionCache.set(jobHash, extractedJob);
    }

    console.log(
      `[ATS Timing] Stage 1 Parallel Extraction completed in ${Date.now() - stage1Start}ms (Resume served by: ${
        resumeCallResult.modelServed
      }, Job served by: ${jobCallResult.modelServed})`
    );
  } catch (err) {
    console.error('Extraction error:', err);
  }

  // NO SILENT DOWNGRADE FOR EXTRACTION:
  // If strong models were rate-limited or unavailable, throw a clean, friendly error. Never serve a degraded score.
  if (!extractedResume || !extractedJob) {
    throw new AnalyzerError(
      'Analysis capacity is limited right now, please try again in a minute',
      429
    );
  }

  // -----------------------------------------------------------------------
  // STAGE 2 — MATCHING (PURE CODE, NO AI)
  // -----------------------------------------------------------------------
  const matchResults = runDeterministicMatching(extractedResume, extractedJob, resumeText);

  // -----------------------------------------------------------------------
  // STAGE 3 — SCORING (PURE CODE, DETERMINISTIC)
  // overall_score = 45% skill_match + 25% experience_fit + 15% education_certifications + 15% ATS_readability
  // -----------------------------------------------------------------------
  const { overall_score, breakdown } = computeDeterministicScore(matchResults);

  // -----------------------------------------------------------------------
  // STAGE 4 — VERDICT (ONE GEMINI CALL, TEMPERATURE 0.2)
  // Receives ONLY computed numbers & match lists. Does NOT alter any scores.
  // -----------------------------------------------------------------------
  let suggestions: string[] = [];

  try {
    const verdictPrompt = buildVerdictPrompt(
      overall_score,
      breakdown,
      matchResults.matchedKeywords,
      matchResults.missingKeywords
    );

    const verdictResult = await callGeminiWithTimeoutAndFallback<{ suggestions: string[] }>(
      'Recruiter Suggestions Verdict',
      verdictModels,
      verdictPrompt,
      VERDICT_SCHEMA,
      8000
    );

    if (Array.isArray(verdictResult.data?.suggestions) && verdictResult.data.suggestions.length > 0) {
      suggestions = verdictResult.data.suggestions;
    }
  } catch (err) {
    console.error('Verdict generation error:', err);
  }

  let isHeuristicMode = false;
  if (!suggestions || suggestions.length === 0) {
    isHeuristicMode = true;
    suggestions = generateDeterministicSuggestions(overall_score, matchResults.missingKeywords, breakdown);
  }

  const result: ATSAnalysisResult = {
    overall_score,
    matched_keywords: matchResults.matchedKeywords,
    missing_keywords: matchResults.missingKeywords,
    suggestions: suggestions.slice(0, 5),
    breakdown,
  };

  if (isHeuristicMode) {
    result.mode = 'heuristic';
  }

  return result;
}
