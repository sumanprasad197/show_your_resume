import { GoogleGenAI, Type } from '@google/genai';

export interface ATSAnalysisResult {
  overall_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: string[];
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

const COMMON_SKILLS_DICTIONARY = [
  // Programming Languages
  'TypeScript', 'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Golang', 'Rust', 'Ruby',
  'PHP', 'Swift', 'Kotlin', 'Scala', 'SQL', 'NoSQL', 'R', 'Bash', 'Shell',

  // Frontend & UI
  'React', 'Next.js', 'Vue.js', 'Angular', 'Svelte', 'Redux', 'Tailwind CSS', 'CSS3', 'HTML5',
  'Webpack', 'Vite', 'Responsive Design', 'Web Accessibility (a11y)', 'State Management',

  // Backend & APIs
  'Node.js', 'Express', 'NestJS', 'Django', 'FastAPI', 'Flask', 'Spring Boot', 'ASP.NET',
  'REST APIs', 'RESTful Services', 'GraphQL', 'gRPC', 'WebSockets', 'Microservices',

  // Databases & Storage
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB', 'Cassandra',
  'Snowflake', 'BigQuery', 'Firebase', 'Supabase', 'ORM / Prisma / TypeORM',

  // Cloud & Infrastructure
  'AWS', 'Amazon Web Services', 'GCP', 'Google Cloud', 'Microsoft Azure', 'Docker',
  'Kubernetes', 'Terraform', 'CI/CD', 'CI/CD Pipeline', 'GitHub Actions', 'Jenkins', 'Linux',
  'Serverless', 'Cloud Architecture', 'Cloud Infrastructure', 'Cloud Systems', 'Kafka', 'RabbitMQ',

  // Engineering Practices & Concepts
  'System Design', 'System Architecture', 'Distributed Systems', 'Performance Optimization',
  'High Availability', 'Scalability', 'Unit Testing', 'Integration Testing', 'Automated Testing',
  'TDD', 'Agile / Scrum', 'Git', 'Object-Oriented Design', 'Code Review', 'Clean Architecture',
  'API Design', 'Database Optimization',

  // Soft Skills & Leadership
  'Team Leadership', 'Mentorship', 'Cross-functional Collaboration', 'Stakeholder Management',
  'Technical Roadmapping', 'Problem Solving', 'Communication', 'Project Management'
];

const STOP_WORDS = new Set([
  'The', 'And', 'For', 'With', 'You', 'Our', 'We', 'Are', 'This', 'Will', 'Must', 'Have',
  'Job', 'Role', 'Company', 'Team', 'Work', 'Years', 'Plus', 'Looking', 'Seeking', 'About',
  'Apply', 'Equal', 'Opportunity', 'Description', 'Requirements', 'Responsibilities',
  'Qualifications', 'Preferred', 'Ideal', 'Candidate', 'Strong', 'Good', 'Great', 'Proven',
  'Track', 'Record', 'Able', 'Ability', 'Working', 'Join', 'Help', 'Build', 'Create', 'Make',
  'Ensure', 'Provide', 'Support', 'Lead', 'Manage', 'Position', 'Location', 'Remote', 'Hybrid',
  'Full', 'Part', 'Time', 'Benefits', 'Salary', 'Competitive', 'Bonus', 'Health', 'Dental',
  'Experience', 'Knowledge', 'Skills', 'Understanding', 'Hands', 'Daily', 'Environment',
  'Degree', 'Bachelor', 'Master', 'Related', 'Field', 'Equivalent', 'Minimum', 'Maximum',
  'Status', 'Overview', 'Summary', 'Expectations', 'What', 'How', 'When', 'Where', 'Who',
  'Senior', 'Junior', 'Software', 'Engineer', 'Developer'
]);

function runLocalAtsAnalysis(resumeText: string, jobDescription: string): ATSAnalysisResult {
  const resumeLower = resumeText.toLowerCase();
  const jobLower = jobDescription.toLowerCase();

  // 1. Identify skills demanded in Job Description
  const matchedSet = new Set<string>();
  const missingSet = new Set<string>();
  const demandedSkills: string[] = [];

  for (const skill of COMMON_SKILLS_DICTIONARY) {
    const skillLower = skill.toLowerCase();
    const escaped = skillLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');

    if (regex.test(jobLower)) {
      demandedSkills.push(skill);
      if (regex.test(resumeLower)) {
        matchedSet.add(skill);
      } else {
        missingSet.add(skill);
      }
    }
  }

  // Extract other legitimate technical keywords or capitalized terms from job description
  const jobWords = jobDescription.match(/\b[A-Z][a-zA-Z0-9+#.-]{1,20}\b/g) || [];
  for (const word of jobWords) {
    if (
      word.length > 2 &&
      !demandedSkills.includes(word) &&
      !STOP_WORDS.has(word)
    ) {
      const wLower = word.toLowerCase();
      if (resumeLower.includes(wLower)) {
        if (matchedSet.size < 14) matchedSet.add(word);
      } else {
        if (missingSet.size < 10) missingSet.add(word);
      }
    }
  }

  const matchedKeywords = Array.from(matchedSet);
  const missingKeywords = Array.from(missingSet);

  // ==============================================================
  // 4-PILLAR STRICT ATS SCORING ENGINE (CALIBRATED TO 100 POINTS)
  // Mirrors the exact rubric given to the Gemini recruiter prompt:
  // Pillar 1: Hard Skills & Keyword Match (40 pts)
  // Pillar 2: Experience Relevance & Quantified Impact (30 pts)
  // Pillar 3: Education & Foundation (15 pts)
  // Pillar 4: ATS Formatting & Structure (15 pts)
  // ==============================================================

  // Pillar 1: Hard Skills & Keyword Match (40 Points Max)
  const totalKeywords = matchedKeywords.length + missingKeywords.length;
  const hardSkillRatio = totalKeywords > 0 ? (matchedKeywords.length / totalKeywords) : 0.65;
  const hardSkillsScore = Math.round(hardSkillRatio * 40);

  // Pillar 2: Experience Relevance, Seniority & Quantified Impact (30 Points Max)
  const jdYearsMatch = jobDescription.match(/(\d+)\+?\s*years/i);
  const requiredYears = jdYearsMatch ? parseInt(jdYearsMatch[1], 10) : 3;
  const resYearsMatch = resumeText.match(/(\d+)\+?\s*years/i);
  const candidateYears = resYearsMatch ? parseInt(resYearsMatch[1], 10) : 4;
  const meetsYears = candidateYears >= requiredYears;

  const metricMatches = resumeText.match(/\b\d+(\.\d+)?%|\$\d+|\b\d{2,}\+?\s*(users|daily|records|defects|minutes|min|latency|cycle|hours|million|billion|k\b)/gi) || [];
  const metricsCount = metricMatches.length;

  let experienceScore = meetsYears ? 14 : 8;
  if (metricsCount >= 4) {
    experienceScore += 15;
  } else if (metricsCount >= 2) {
    experienceScore += 10;
  } else {
    experienceScore += 4;
  }

  // Pillar 3: Education, Academic Foundation & Certifications (15 Points Max)
  let educationScore = 6;
  if (/b\.?s\.?|bachelor|master|m\.?s\.?|computer science|engineering|degree|ph\.?d|certified|certification/i.test(resumeText)) {
    educationScore = 14;
  } else if (/associate|diploma|bootcamp/i.test(resumeText)) {
    educationScore = 10;
  }

  // Pillar 4: ATS Formatting, Readability & Action Verbs (15 Points Max)
  let formattingScore = 5;
  const hasSummary = /summary|profile|about/i.test(resumeText);
  const hasExperience = /experience|work history|employment/i.test(resumeText);
  const hasEducation = /education|university|college/i.test(resumeText);
  const hasSkills = /skills|competencies|technologies/i.test(resumeText);
  const sectionCount = [hasSummary, hasExperience, hasEducation, hasSkills].filter(Boolean).length;
  formattingScore += (sectionCount * 2); // up to +8

  const actionVerbMatches = resumeText.match(/\b(architected|redesigned|delivered|established|mentored|developed|optimized|implemented|partnered|spearheaded|engineered|built|led|designed)\b/gi) || [];
  if (actionVerbMatches.length >= 4) {
    formattingScore += 2;
  } else if (actionVerbMatches.length >= 2) {
    formattingScore += 1;
  }

  // Derived Overall Score (0 - 100)
  const calculatedTotal = hardSkillsScore + experienceScore + educationScore + formattingScore;
  const overall_score = Math.max(20, Math.min(96, calculatedTotal));

  // 3. Generate Strict Recruiter Actionable Suggestions
  const suggestions: string[] = [];

  if (missingKeywords.length > 0) {
    const topMissing = missingKeywords.slice(0, 3).join(', ');
    suggestions.push(
      `Explicitly weave high-priority requirements (${topMissing}) into your core technical skills and recent project accomplishments.`
    );
  }

  if (metricsCount < 3) {
    suggestions.push(
      'Quantify your business impact — replace generic task descriptions with measurable outcomes (e.g., "improved performance by 35%" or "scaled service to 100k+ daily users").'
    );
  } else {
    suggestions.push(
      'Strengthen your impact metrics by tying each bullet directly to company ROI, reduced latency, or team velocity.'
    );
  }

  suggestions.push(
    'Align your resume summary and job titles directly with the target role to pass initial algorithmic ATS filters before recruiter review.'
  );

  if (overall_score < 75) {
    suggestions.push(
      'Ensure standard ATS section headers (Professional Experience, Technical Skills, Education) are clearly labeled without non-standard nested formatting.'
    );
  } else {
    suggestions.push(
      'Elevate leadership and architectural ownership bullet points to the top third of your most recent role.'
    );
  }

  return {
    overall_score,
    matched_keywords: matchedKeywords.slice(0, 14),
    missing_keywords: missingKeywords.slice(0, 10),
    suggestions: suggestions.slice(0, 4),
  };
}

const ATS_SYSTEM_INSTRUCTION =
  'You are a strict, seasoned corporate recruiter and elite Applicant Tracking System (ATS) algorithm specialist. You evaluate resumes against job descriptions with rigorous corporate hiring standards, uncompromising realistic scoring, and constructive actionable feedback. Never give arbitrary, unearned, or inflated scores. Every deduction and point awarded must be justified by concrete textual evidence from the candidate\'s resume and the job requirements.';

const ATS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overall_score: {
      type: Type.INTEGER,
      description: 'Strict ATS match score from 0 to 100 derived from the weighted 4-pillar rubric',
    },
    matched_keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Keywords and skills present in both resume and job description',
    },
    missing_keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Key skills and qualifications demanded by the job description but absent from the resume',
    },
    suggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3 to 5 strict, specific, actionable recruiter recommendations citing resume evidence',
    },
  },
  required: ['overall_score', 'matched_keywords', 'missing_keywords', 'suggestions'],
};

function buildRecruiterPrompt(resumeText: string, jobDescription: string): string {
  return `You are a strict, senior technical recruiter and ATS algorithm specialist.
Evaluate the candidate's resume text against the provided job description using high corporate standards and realistic ATS scoring.

==================================================
STRICT ATS WEIGHTED SCORING RUBRIC (Total: 100 Points)
==================================================
You MUST calculate "overall_score" by evaluating and summing the points awarded across the following 4 weighted categories based on concrete textual evidence:

1. HARD SKILLS & KEYWORD ALIGNMENT (40 Points Max):
   - Compare the candidate's verified technical skills, programming languages, frameworks, cloud platforms, databases, and architectural concepts against the job description requirements.
   - 35-40: Near-complete alignment with all primary and secondary tools, libraries, and core stack requirements.
   - 25-34: Strong match on core language/framework, with minor gaps in secondary libraries or specialized tools.
   - 15-24: Foundational skill overlap exists, but missing multiple critical technical requirements or primary framework competencies.
   - 0-14: Severe mismatch; missing the core technical stack required for the role.

2. EXPERIENCE RELEVANCE, SENIORITY & QUANTIFIED IMPACT (30 Points Max):
   - Compare years of professional experience against the JD seniority requirements (e.g., 5+ years for Senior roles).
   - Evaluate scope of ownership, architectural leadership, team mentorship, and system scale.
   - Evaluate quantified impact: presence of concrete metrics, percentages, throughput numbers, latency reductions, user scale, or business ROI in bullet points.
   - 26-30: Exceeds or meets required seniority, demonstrates clear technical leadership, and consistently substantiates accomplishments with strong quantified impact metrics.
   - 18-25: Relevant experience and meets years requirement, but lacks leadership scope or has only moderate quantified metrics.
   - 10-17: Relevant field but junior/mid-level when senior is required, or accomplishments are purely task-oriented without measurable business impact.
   - 0-9: Irrelevant work history or substantially below the minimum required experience level.

3. EDUCATION, DOMAIN FOUNDATION & CERTIFICATIONS (15 Points Max):
   - Evaluate academic degree relevance (Computer Science, Software Engineering, STEM, or equivalent proven career trajectory) and verified industry certifications.
   - 13-15: Direct degree match (e.g., B.S./M.S. in Computer Science/related discipline) and/or recognized domain certifications.
   - 8-12: Related quantitative degree or substantial proven industry equivalent.
   - 0-7: Education missing or unrelated without demonstrable compensatory foundational background.

4. ATS FORMATTING, STRUCTURE & ACTION-ORIENTED READABILITY (15 Points Max):
   - Check standard ATS section headers (Professional Summary, Experience/Employment History, Core Competencies/Skills, Education).
   - Check reverse-chronological layout, clear role titles, employment date ranges, clean bullet hierarchy.
   - Check active voice: bullets starting with strong action verbs (e.g., "Architected", "Optimized", "Spearheaded") rather than passive phrasing ("Responsible for", "Assisted with").
   - 13-15: Pristine ATS-compliant structure, standard section titles, strong action verbs, highly parseable.
   - 8-12: Clean structure with minor formatting or verb inconsistencies.
   - 0-7: Non-standard headers, poor chronology, or unparseable blocks of text.

OVERALL SCORE CALCULATION:
- Sum the scores from the 4 categories: Category 1 (0-40) + Category 2 (0-30) + Category 3 (0-15) + Category 4 (0-15) = overall_score (0-100).
- Example benchmark: A candidate with 6+ years experience, Computer Science B.S., strong React/Node/Postgres/AWS skill match, high-impact quantified metrics, and clean ATS formatting should score in the ~80-84 range.
- Do not inflate scores. Ground every point in the candidate's actual textual evidence.

OUTPUT JSON REQUIREMENTS:
1. "overall_score": Integer from 0 to 100 derived strictly from the rubric above.
2. "matched_keywords": Array of 6 to 15 concise, high-value skill/technology chips present in both the resume and the job description.
3. "missing_keywords": Array of 4 to 10 important skills, qualifications, or tools demanded in the job description that are absent or weak in the resume.
4. "suggestions": Array of 3 to 5 strict, prioritized, actionable recruiter recommendations written in the direct, constructive voice of an executive hiring manager citing specific resume sections.

RESUME TEXT:
"""
${resumeText.slice(0, 15000)}
"""

JOB DESCRIPTION:
"""
${jobDescription.slice(0, 10000)}
"""`;
}

/**
 * Universal ATS Resume Analyzer
 * Pure logic module located inside the api directory for universal compatibility.
 */
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

  const prompt = buildRecruiterPrompt(resumeText, jobDescription);

  const modelsToTry = [
    { model: 'gemini-3.8-flash', retries: 1, delayMs: 400, config: { temperature: 0.2 } },
    { model: 'gemini-3.6-flash', retries: 1, delayMs: 400, config: { temperature: 0.2 } },
    { model: 'gemini-flash-latest', retries: 0, delayMs: 300, config: { temperature: 0.2 } },
    { model: 'gemini-3.1-flash-lite', retries: 0, delayMs: 300, config: { temperature: 0.2 } },
  ];

  let responseText = '';
  let lastError: any = null;

  for (const attempt of modelsToTry) {
    for (let r = 0; r <= attempt.retries; r++) {
      try {
        const result = await ai.models.generateContent({
          model: attempt.model,
          contents: prompt,
          config: {
            systemInstruction: ATS_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: ATS_RESPONSE_SCHEMA,
            ...attempt.config,
          },
        });

        if (result?.text) {
          responseText = result.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        // If API key is explicitly invalid, fail fast
        if (err?.message?.includes('API key') || err?.status === 401 || err?.status === 403) {
          throw new AnalyzerError('API key error. Please verify your GEMINI_API_KEY environment variable.', 401);
        }
        if (r < attempt.retries) {
          await delay(attempt.delayMs * (r + 1));
        }
      }
    }
    if (responseText) break;
  }

  // Parse structured AI response
  if (responseText) {
    try {
      const parsedData = JSON.parse(responseText.trim());
      const overall_score = Math.max(0, Math.min(100, Math.round(Number(parsedData.overall_score) || 0)));
      const matched_keywords = Array.isArray(parsedData.matched_keywords) ? parsedData.matched_keywords : [];
      const missing_keywords = Array.isArray(parsedData.missing_keywords) ? parsedData.missing_keywords : [];
      const suggestions = Array.isArray(parsedData.suggestions) ? parsedData.suggestions : [];

      return {
        overall_score,
        matched_keywords,
        missing_keywords,
        suggestions,
      };
    } catch {
      // Fall through to algorithmic backup if JSON parsing fails
    }
  }

  // If external AI service has a transient 503 capacity spike, provide algorithmic analysis seamlessly
  if (lastError && !responseText) {
    console.log('Notice: Upstream AI capacity limitation detected; serving algorithmic ATS recruiter analysis.');
  }

  return runLocalAtsAnalysis(resumeText, jobDescription);
}
