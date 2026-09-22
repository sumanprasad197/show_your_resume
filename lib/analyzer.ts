import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { runLocalAtsAnalysis } from './atsEngine';

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

const ATS_SYSTEM_INSTRUCTION =
  'You are a strict, rigorous Applicant Tracking System (ATS) recruiter and hiring specialist. Analyze resumes against job descriptions and output structured JSON with accurate match scores and constructive recruiter feedback.';

const ATS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overall_score: {
      type: Type.INTEGER,
      description: 'ATS match score from 0 to 100',
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
      description: '3 to 5 strict, specific, actionable recruiter recommendations',
    },
  },
  required: ['overall_score', 'matched_keywords', 'missing_keywords', 'suggestions'],
};

function buildRecruiterPrompt(resumeText: string, jobDescription: string): string {
  return `You are a strict, seasoned corporate recruiter and Applicant Tracking System (ATS) algorithm specialist.
Evaluate the candidate's resume text against the provided job description with high standards and realistic corporate ATS scoring.

CRITICAL INSTRUCTIONS:
1. "overall_score": An integer from 0 to 100 representing the ATS match percentage.
   - Under 50: Poor match, critical hard skills or experience missing.
   - 50 to 75: Moderate match, has foundational skills but missing several key requirements or domain depth.
   - Above 75: Strong match, aligns well with key requirements, tools, and seniority.
   Be realistic and strict like a real recruiter; do not give inflated scores.

2. "matched_keywords": Array of exact or closely matching skills, technologies, qualifications, methodologies, and requirements found in BOTH the resume and the job description.
   Provide 6 to 15 concise keyword chips (e.g., "TypeScript", "System Design", "Agile / Scrum", "CI/CD").

3. "missing_keywords": Array of important skills, qualifications, certifications, tools, or domain experience explicitly or implicitly demanded in the job description that are NOT found in the resume.
   Provide 4 to 12 concise keyword chips (e.g., "Kubernetes", "GraphQL", "Performance Profiling", "Team Mentorship").

4. "suggestions": An array of 3 to 5 numbered, high-impact, specific, actionable improvements written in the direct, constructive voice of a strict corporate recruiter (e.g., "Quantify your achievements — add concrete metrics and percentages to your bullet points instead of passive task descriptions", "Explicitly integrate missing keywords like [X] into your experience sections where applicable").

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
 * Pure logic module — ZERO platform-specific and ZERO UI dependencies.
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
    { model: 'gemini-3.8-flash', retries: 2, delayMs: 1200, config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } },
    { model: 'gemini-3.1-flash-lite', retries: 1, delayMs: 1000, config: {} },
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

  // If external AI service has a transient 503 capacity spike, provide algorithmic analysis
  if (lastError && !responseText) {
    console.warn('Gemini service unavailable, engaging high-precision fallback engine:', lastError?.message || lastError);
  }

  return runLocalAtsAnalysis(resumeText, jobDescription);
}
