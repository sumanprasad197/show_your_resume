import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { runLocalAtsAnalysis } from './src/server/atsEngine';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Helper sleep function for retry backoff
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Resume analysis endpoint
app.post('/api/analyze-resume', async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body;

    if (!resumeText || typeof resumeText !== 'string' || resumeText.trim().length < 20) {
      return res.status(400).json({
        error: 'This looks like a scanned PDF — try a text-based version',
      });
    }

    if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length < 30) {
      return res.status(400).json({
        error: 'Job description is too short. Please paste at least a few sentences or the full job requirements for an accurate ATS analysis.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Gemini API key is not configured. Please ensure GEMINI_API_KEY is provided in settings.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `You are a strict, seasoned corporate recruiter and Applicant Tracking System (ATS) algorithm specialist.
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

    const schema = {
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

    // Resilient invocation with automatic retry and local ATS fallback against transient 503 high demand spikes
    let responseText = '';
    const modelsToTry = [
      { model: 'gemini-3.8-flash', retries: 2, delayMs: 1200, config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } },
      { model: 'gemini-3.1-flash-lite', retries: 1, delayMs: 1000, config: {} },
    ];

    for (const attempt of modelsToTry) {
      for (let r = 0; r <= attempt.retries; r++) {
        try {
          const result = await ai.models.generateContent({
            model: attempt.model,
            contents: prompt,
            config: {
              systemInstruction:
                'You are a strict, rigorous Applicant Tracking System (ATS) recruiter. Analyze resumes against job descriptions and output structured JSON with accurate match scores and recruiter feedback.',
              responseMimeType: 'application/json',
              responseSchema: schema,
              ...attempt.config,
            },
          });

          if (result?.text) {
            responseText = result.text;
            break;
          }
        } catch (err: any) {
          // If transient 503 or 429, wait and retry silently
          if (r < attempt.retries) {
            await delay(attempt.delayMs * (r + 1));
          }
        }
      }
      if (responseText) break;
    }

    // Parse AI model response or fall back gracefully to the high-precision local ATS engine
    if (responseText) {
      try {
        const parsedData = JSON.parse(responseText.trim());
        const overall_score = Math.max(0, Math.min(100, Math.round(Number(parsedData.overall_score) || 0)));
        const matched_keywords = Array.isArray(parsedData.matched_keywords) ? parsedData.matched_keywords : [];
        const missing_keywords = Array.isArray(parsedData.missing_keywords) ? parsedData.missing_keywords : [];
        const suggestions = Array.isArray(parsedData.suggestions) ? parsedData.suggestions : [];

        return res.json({
          overall_score,
          matched_keywords,
          missing_keywords,
          suggestions,
        });
      } catch {
        // Fall through to local ATS fallback if JSON parsing failed
      }
    }

    // Fallback: If external AI service is experiencing a 503 capacity spike, provide exact algorithmic ATS analysis
    const fallbackData = runLocalAtsAnalysis(resumeText, jobDescription);
    return res.json(fallbackData);
  } catch (err: any) {
    return res.status(500).json({
      error:
        err?.message?.includes('API key')
          ? 'API key error. Please verify the Gemini API key in settings.'
          : 'Failed to analyze resume. The AI service encountered a temporary error. Please try again.',
    });
  }
});

// Vite middleware for development or static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
