import { analyzeResume, AnalyzerError } from '../lib/analyzer';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed. Please use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const result = await analyzeResume({
      resumeText: body.resumeText,
      jobDescription: body.jobDescription,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    const status = error instanceof AnalyzerError ? error.status : (error?.status || 500);
    const message = error?.message || 'Failed to analyze resume. Please try again.';
    return res.status(status).json({ error: message });
  }
}
