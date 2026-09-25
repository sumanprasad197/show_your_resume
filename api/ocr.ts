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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

function is503Error(parsed: { message: string; code?: number; status?: string }, rawErr: any): boolean {
  if (parsed.code === 503 || parsed.status === 'UNAVAILABLE') return true;
  if (rawErr?.status === 503 || rawErr?.code === 503) return true;
  const combined = `${parsed.message} ${parsed.status || ''} ${rawErr?.message || ''}`.toLowerCase();
  return (
    combined.includes('503') ||
    combined.includes('unavailable') ||
    combined.includes('high demand') ||
    combined.includes('temporarily unavailable') ||
    combined.includes('server overload')
  );
}

function is429Error(parsed: { message: string; code?: number; status?: string }, rawErr: any): boolean {
  if (parsed.code === 429 || parsed.status === 'RESOURCE_EXHAUSTED') return true;
  if (rawErr?.status === 429 || rawErr?.code === 429) return true;
  const combined = `${parsed.message} ${parsed.status || ''} ${rawErr?.message || ''}`.toLowerCase();
  return combined.includes('429') || combined.includes('quota') || combined.includes('resource_exhausted');
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

  const modelAttempts: {
    pass: number;
    model: string;
    attempt: number;
    outcome: 'success' | 'empty' | 'error';
    message: string;
    code?: number;
    is503?: boolean;
  }[] = [];

  let encountered503 = false;

  // Run up to 2 complete passes through the waterfall
  for (let pass = 1; pass <= 2; pass++) {
    if (pass === 2) {
      // Requirement 2: After the full waterfall fails, wait 5 seconds and run one more complete pass
      console.log('[OCR] Full waterfall failed. Waiting 5 seconds before running one more complete pass...');
      await sleep(5000);
    }

    for (const model of models) {
      // Requirement 1: when a model returns 503/UNAVAILABLE, wait 3 seconds and retry the SAME model, up to 3 attempts
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(
            `[OCR] [Pass ${pass}] Model ${model} (Attempt ${attempt}/${maxAttempts}) - File size: ${fileSizeMB} MB`
          );

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
            console.log(
              `[OCR Success] [Pass ${pass}] Model ${model} succeeded on attempt ${attempt} (${extractedText.length} chars).`
            );
            return { text: extractedText, fileSizeBytes };
          }

          console.warn(`[OCR Warning] [Pass ${pass}] Model ${model} returned empty text (0 characters).`);
          modelAttempts.push({
            pass,
            model,
            attempt,
            outcome: 'empty',
            message: 'Model returned 0 characters (empty text response).',
          });
          // Do not retry on empty text; move to next model
          break;
        } catch (err: any) {
          const parsed = parseApiError(err);
          const errIs429 = is429Error(parsed, err);
          const errIs503 = !errIs429 && is503Error(parsed, err);

          if (errIs503) {
            encountered503 = true;
          }

          console.warn(
            `[OCR Error] [Pass ${pass}] Model ${model} (Attempt ${attempt}) failed: ${parsed.message} (is503: ${errIs503}, is429: ${errIs429})`
          );

          modelAttempts.push({
            pass,
            model,
            attempt,
            outcome: 'error',
            message: parsed.message,
            code: parsed.code,
            is503: errIs503,
          });

          // Requirement 1: when a model returns 503/UNAVAILABLE, wait 3 seconds and retry the SAME model, up to 3 attempts
          if (errIs503 && attempt < maxAttempts) {
            console.log(
              `[OCR] Model ${model} returned 503/UNAVAILABLE. Waiting 3 seconds before retry attempt ${attempt + 1}...`
            );
            await sleep(3000);
            continue; // retry same model
          }

          // Requirement 5: Do NOT auto-retry on 429 quota errors (or other non-503 errors); move to next model
          break;
        }
      }
    }

    // If Pass 1 completed without encountering any 503 errors (e.g. only 429 quota errors),
    // do NOT run Pass 2 (satisfies Requirement 5: Do NOT auto-retry on 429 quota errors)
    if (pass === 1 && !encountered503) {
      console.log('[OCR] Pass 1 completed without 503 errors; skipping pass 2.');
      break;
    }
  }

  // Requirement 4: If it still fails after all retries, log details server-side
  console.error('[OCR Failure Diagnostic after all retries]', {
    fileSizeBytes,
    fileSizeMB,
    encountered503,
    modelAttempts,
  });

  // Requirement 4: If 503 caused the failure after all retries, return the specific friendly busy error
  if (encountered503) {
    throw new OcrError(
      "Google's AI servers are temporarily busy. Please try again in a few minutes.",
      503,
      { fileSizeBytes, fileSizeMB, modelAttempts }
    );
  }

  // Check if all models returned empty text
  const allEmpty = modelAttempts.every((a) => a.outcome === 'empty');
  if (allEmpty) {
    throw new OcrError(
      `OCR completed but returned 0 text characters from this PDF (${fileSizeMB} MB). The file may be blank, unreadable, or corrupted.`,
      422,
      { fileSizeBytes, fileSizeMB, modelAttempts }
    );
  }

  // If failed due to 429 or other errors, retain the specific error message
  const firstError = modelAttempts.find((a) => a.outcome === 'error');
  const lastAttempt = modelAttempts[modelAttempts.length - 1];
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
