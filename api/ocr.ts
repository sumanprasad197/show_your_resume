import { GoogleGenAI } from '@google/genai';

export class OcrError extends Error {
  status: number;
  details?: Record<string, any>;

  constructor(message: string, status: number = 500, details?: Record<string, any>) {
    super(message);
    this.name = 'OcrError';
    this.status = status;
    this.details = details;
  }
}

export interface PerformOcrParams {
  pdfBase64: string;
}

/**
 * Extracts a readable message from Google Gemini API errors.
 */
function parseApiError(err: any): { message: string; code?: number; status?: string } {
  if (!err) return { message: 'Unknown error occurred.' };
  if (typeof err === 'string') return { message: err };

  // Error message may contain JSON string from the API client
  if (typeof err.message === 'string') {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed?.error) {
        const code = parsed.error.code;
        const status = parsed.error.status;
        const msg = parsed.error.message || err.message;
        const prefix = code ? `[API ${code}${status ? ` / ${status}` : ''}] ` : '';
        return { message: `${prefix}${msg}`.trim(), code, status };
      }
    } catch {
      // not a JSON string, continue
    }
  }

  if (err.error?.message) {
    const code = err.error.code;
    const status = err.error.status;
    const msg = err.error.message;
    const prefix = code ? `[API ${code}${status ? ` / ${status}` : ''}] ` : '';
    return { message: `${prefix}${msg}`.trim(), code, status };
  }

  return { message: err.message || String(err) };
}

export async function performOcr(params: PerformOcrParams): Promise<{ text: string; fileSizeBytes: number }> {
  const { pdfBase64 } = params;

  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    throw new OcrError('No PDF data provided for OCR extraction (empty payload received).', 400);
  }

  // Strip data-URI prefix if present (e.g. "data:application/pdf;base64,") and any whitespace/newlines
  const cleanBase64 = pdfBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '').trim();

  if (!cleanBase64) {
    throw new OcrError('PDF data is empty after stripping data URI header (0 bytes).', 400);
  }

  // Calculate actual binary byte length from clean base64
  let fileSizeBytes = 0;
  try {
    fileSizeBytes = Buffer.byteLength(cleanBase64, 'base64');
  } catch {
    fileSizeBytes = Math.ceil((cleanBase64.length * 3) / 4);
  }

  const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

  // Validate 10 MB limit
  if (fileSizeBytes > 10 * 1024 * 1024) {
    const errorMsg = `Scanned PDF exceeds 10 MB limit (${fileSizeMB} MB received). Please try a text-based version or compress the PDF to under 10 MB.`;
    console.warn(`[OCR Rejected] ${errorMsg}`);
    throw new OcrError(errorMsg, 400, { fileSizeBytes, fileSizeMB });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const errorMsg = 'Server Gemini API key is not configured (GEMINI_API_KEY missing in environment).';
    console.error(`[OCR Error] ${errorMsg}`);
    throw new OcrError(errorMsg, 500);
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Same model waterfall as the rest of the application
  const models = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];
  const prompt =
    'Extract ALL text from this resume PDF as plain text, preserving the content, order, and structure. Return only the text.';

  const modelAttempts: { model: string; outcome: 'success' | 'empty' | 'error'; message: string; code?: number }[] = [];

  for (const model of models) {
    try {
      console.log(`[OCR] Attempting extraction with model: ${model} (File size: ${fileSizeMB} MB)`);
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: cleanBase64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      });

      const extractedText = response.text ? response.text.trim() : '';
      if (extractedText.length > 0) {
        console.log(`[OCR Success] Model ${model} extracted ${extractedText.length} characters.`);
        return { text: extractedText, fileSizeBytes };
      }

      console.warn(`[OCR Warning] Model ${model} responded with 200 OK but returned empty text (0 characters).`);
      modelAttempts.push({
        model,
        outcome: 'empty',
        message: 'Model returned 0 characters (empty text response).',
      });
    } catch (err: any) {
      const parsed = parseApiError(err);
      console.warn(`[OCR Error] Model ${model} failed: ${parsed.message}`);
      modelAttempts.push({
        model,
        outcome: 'error',
        message: parsed.message,
        code: parsed.code,
      });
    }
  }

  // If we reach here, all models in the waterfall failed or returned empty text
  console.error('[OCR Exhausted Waterfall Diagnostics]', {
    fileSizeBytes,
    fileSizeMB,
    modelAttempts,
  });

  // Build specific, informative error message
  const allEmpty = modelAttempts.every((a) => a.outcome === 'empty');
  if (allEmpty) {
    throw new OcrError(
      `OCR completed but returned 0 text characters from this PDF (${fileSizeMB} MB). The file may be blank, unreadable, or corrupted.`,
      422,
      { fileSizeBytes, fileSizeMB, modelAttempts }
    );
  }

  // Find the primary error from models
  const lastAttempt = modelAttempts[modelAttempts.length - 1];
  const firstError = modelAttempts.find((a) => a.outcome === 'error');
  const primaryErrorText = firstError?.message || lastAttempt?.message || 'Unknown model error';

  throw new OcrError(
    `OCR failed across models (${models.join(' → ')}): ${primaryErrorText} (${fileSizeMB} MB PDF)`,
    502,
    { fileSizeBytes, fileSizeMB, modelAttempts }
  );
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed. Please use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const result = await performOcr({ pdfBase64: body.pdfBase64 });
    return res.status(200).json(result);
  } catch (error: any) {
    const status = error instanceof OcrError ? error.status : error?.status || 500;
    const message = error?.message || 'Unexpected failure during PDF OCR processing.';
    return res.status(status).json({
      error: message,
      details: error?.details || undefined,
    });
  }
}
