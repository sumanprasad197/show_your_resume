import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { analyzeResume, AnalyzerError } from './lib/analyzer';

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

// Universal ATS Resume Analysis endpoint
app.route('/api/analyze')
  .post(async (req, res) => {
    try {
      const result = await analyzeResume({
        resumeText: req.body?.resumeText,
        jobDescription: req.body?.jobDescription,
      });
      return res.status(200).json(result);
    } catch (error: any) {
      const status = error instanceof AnalyzerError ? error.status : (error?.status || 500);
      const message = error?.message || 'Failed to analyze resume. Please try again.';
      return res.status(status).json({ error: message });
    }
  })
  .all((_req, res) => {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: 'Method not allowed. Please use POST.' });
  });

// Backward-compatibility alias for legacy clients
app.route('/api/analyze-resume')
  .post(async (req, res) => {
    try {
      const result = await analyzeResume({
        resumeText: req.body?.resumeText,
        jobDescription: req.body?.jobDescription,
      });
      return res.status(200).json(result);
    } catch (error: any) {
      const status = error instanceof AnalyzerError ? error.status : (error?.status || 500);
      const message = error?.message || 'Failed to analyze resume. Please try again.';
      return res.status(status).json({ error: message });
    }
  })
  .all((_req, res) => {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: 'Method not allowed. Please use POST.' });
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
