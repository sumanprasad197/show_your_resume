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
  pdfBase64?: string | null;
  imagesBase64?: string[] | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`[Timeout] ${label} exceeded ${ms}ms limit`));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
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

export async function performOcr(params: PerformOcrParams): Promise<{ text: string; fileSizeBytes: number; ocrMode: string }> {
  const { pdfBase64, imagesBase64 } = params;

  // 1. Clean and validate inputs
  const cleanImages: string[] = [];
  if (Array.isArray(imagesBase64) && imagesBase64.length > 0) {
    for (const img of imagesBase64) {
      if (typeof img === 'string') {
        const clean = img.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '').trim();
        if (clean.length > 0) {
          cleanImages.push(clean);
        }
      }
    }
  }

  const cleanPdf =
    typeof pdfBase64 === 'string'
      ? pdfBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '').trim()
      : '';

  if (cleanImages.length === 0 && !cleanPdf) {
    throw new OcrError('No PDF or rendered page image data provided for OCR extraction (empty payload received).', 400);
  }

  // Determine OCR path: prefer rendered JPEG page images; fallback to raw PDF
  const ocrMode: 'images' | 'pdf' = cleanImages.length > 0 ? 'images' : 'pdf';

  // Calculate actual binary byte length
  let fileSizeBytes = 0;
  if (ocrMode === 'images') {
    for (const img of cleanImages) {
      try {
        fileSizeBytes += Buffer.byteLength(img, 'base64');
      } catch {
        fileSizeBytes += Math.ceil((img.length * 3) / 4);
      }
    }
  } else {
    try {
      fileSizeBytes = Buffer.byteLength(cleanPdf, 'base64');
    } catch {
      fileSizeBytes = Math.ceil((cleanPdf.length * 3) / 4);
    }
  }

  const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

  // Validate 10 MB limit
  if (fileSizeBytes > 10 * 1024 * 1024) {
    const errorMsg = `Payload exceeds 10 MB limit (${fileSizeMB} MB received). Please try a text-based version or compress the PDF to under 10 MB.`;
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

  // Model waterfall
  const models = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];
  const prompt =
    'Transcribe ALL visible text from this scanned document, page by page, as plain text. Preserve order and line breaks. Output only the transcribed text.';

  const OCR_OVERALL_DEADLINE_MS = 45000;
  const startTime = Date.now();

  // Log which path was selected
  console.log(
    `[OCR Server] Active Path: ${ocrMode.toUpperCase()} (${
      ocrMode === 'images' ? `${cleanImages.length} rendered JPEG page(s)` : `${fileSizeMB} MB raw PDF`
    })`
  );

  // Build inlineData parts for Gemini request
  let contentParts: any[];
  if (ocrMode === 'images') {
    contentParts = cleanImages.map((img) => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: img,
      },
    }));
    contentParts.push({ text: prompt });
  } else {
    contentParts = [
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: cleanPdf,
        },
      },
      { text: prompt },
    ];
  }

  const modelAttempts: {
    model: string;
    attempt: number;
    outcome: 'success' | 'empty' | 'error';
    message: string;
    code?: number;
    is503?: boolean;
    ocrMode: string;
  }[] = [];

  let encountered503 = false;

  // Single pass through the waterfall with max 2 attempts per model and 45s overall deadline
  for (const model of models) {
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const elapsed = Date.now() - startTime;
      const remainingDeadline = OCR_OVERALL_DEADLINE_MS - elapsed;
      if (remainingDeadline <= 1000) {
        console.warn(
          `[OCR] Overall deadline of 45s reached (${elapsed}ms elapsed). Halting OCR attempts.`
        );
        break;
      }

      const callTimeout = Math.min(12000, remainingDeadline);

      try {
        console.log(
          `[OCR] [Path: ${ocrMode.toUpperCase()}] Model ${model} (Attempt ${attempt}/${maxAttempts}) - Payload: ${fileSizeMB} MB`
        );

        const ocrConfig: any = {
          maxOutputTokens: 16384,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        };

        let response: any;
        try {
          response = await withTimeout(
            ai.models.generateContent({
              model,
              contents: {
                parts: contentParts,
              },
              config: ocrConfig,
            }),
            callTimeout,
            `OCR generateContent (${model} [${ocrMode}] with thinkingBudget: 0)`
          );
        } catch (callErr: any) {
          const errMsg = (callErr?.message || String(callErr)).toLowerCase();
          // If model does not support thinkingBudget: 0, retry with thinkingLevel: MINIMAL
          if (errMsg.includes('thinking') || errMsg.includes('budget')) {
            console.warn(
              `[OCR] Model ${model} rejected thinkingBudget: 0 (${callErr?.message}). Retrying with thinkingLevel: MINIMAL...`
            );
            ocrConfig.thinkingConfig = {
              thinkingLevel: 'MINIMAL',
            };
            response = await withTimeout(
              ai.models.generateContent({
                model,
                contents: {
                  parts: contentParts,
                },
                config: ocrConfig,
              }),
              callTimeout,
              `OCR generateContent (${model} [${ocrMode}] with thinkingLevel: MINIMAL)`
            );
          } else {
            throw callErr;
          }
        }

        // Log whether response.text is undefined vs empty string
        const rawText = response?.text;
        const isUndefined = rawText === undefined;
        const isEmptyString = rawText === '';
        console.log(
          `[OCR] [Path: ${ocrMode.toUpperCase()}] Model ${model} response.text evaluation: ${
            isUndefined
              ? 'undefined'
              : isEmptyString
              ? 'empty string ("")'
              : `string (${rawText.length} characters)`
          }`
        );

        let extractedText = typeof rawText === 'string' ? rawText.trim() : '';

        // If response.text is undefined or empty string, inspect response.candidates[0].content.parts directly for text parts
        const candidate0 = response?.candidates?.[0];
        const responseParts = candidate0?.content?.parts;

        if (!extractedText && Array.isArray(responseParts) && responseParts.length > 0) {
          const directTextParts: string[] = [];
          for (const part of responseParts) {
            if (typeof part?.text === 'string' && part.text.trim().length > 0 && !part?.thought) {
              directTextParts.push(part.text.trim());
            }
          }
          if (directTextParts.length > 0) {
            extractedText = directTextParts.join('\n\n').trim();
            console.log(
              `[OCR] Recovered ${extractedText.length} characters directly from candidates[0].content.parts for model ${model}`
            );
          }
        }

        if (extractedText.length > 0) {
          console.log(
            `[OCR Success] [Path: ${ocrMode.toUpperCase()}] Model ${model} succeeded on attempt ${attempt} (${extractedText.length} chars).`
          );
          return { text: extractedText, fileSizeBytes, ocrMode };
        }

        // When extracted text is empty, log full diagnostics to server console
        console.warn(`[OCR Warning] Model ${model} returned empty text (0 characters). Full Diagnostics:`, {
          ocrPath: ocrMode,
          pagesCount: ocrMode === 'images' ? cleanImages.length : 1,
          model,
          attempt,
          rawResponseText: isUndefined ? 'undefined' : isEmptyString ? '"" (empty string)' : typeof rawText,
          finishReason: candidate0?.finishReason || 'N/A',
          hasContentParts: Array.isArray(responseParts) && responseParts.length > 0,
          contentPartsCount: Array.isArray(responseParts) ? responseParts.length : 0,
          contentPartsSummary: Array.isArray(responseParts)
            ? responseParts.map((p: any) => ({
                keys: Object.keys(p || {}),
                isThought: !!p?.thought,
                hasText: typeof p?.text === 'string' && p.text.length > 0,
                textLength: typeof p?.text === 'string' ? p.text.length : 0,
              }))
            : null,
          usageMetadata: response?.usageMetadata
            ? {
                promptTokenCount: response.usageMetadata.promptTokenCount,
                candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
                totalTokenCount: response.usageMetadata.totalTokenCount,
                thoughtsTokenCount: (response.usageMetadata as any).thoughtsTokenCount ?? 'N/A',
              }
            : 'No usageMetadata',
        });

        modelAttempts.push({
          model,
          attempt,
          outcome: 'empty',
          message: 'Model returned 0 characters (empty text response).',
          ocrMode,
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
          `[OCR Error] [Path: ${ocrMode.toUpperCase()}] Model ${model} (Attempt ${attempt}) failed: ${parsed.message} (is503: ${errIs503}, is429: ${errIs429})`
        );

        modelAttempts.push({
          model,
          attempt,
          outcome: 'error',
          message: parsed.message,
          code: parsed.code,
          is503: errIs503,
          ocrMode,
        });

        // 503 retry with backoff: wait 2 seconds and retry the SAME model, up to 2 attempts
        if (errIs503 && attempt < maxAttempts) {
          const timeAfterError = Date.now() - startTime;
          if (timeAfterError + 2000 < OCR_OVERALL_DEADLINE_MS) {
            console.log(
              `[OCR] Model ${model} returned 503/UNAVAILABLE. Waiting 2 seconds before retry attempt ${attempt + 1}...`
            );
            await sleep(2000);
            continue; // retry same model
          } else {
            console.warn(`[OCR] Not enough time left before 45s deadline to retry model ${model}.`);
          }
        }

        // Do NOT auto-retry on 429 quota errors (or other non-503 errors); move to next model
        break;
      }
    }

    if (Date.now() - startTime >= OCR_OVERALL_DEADLINE_MS) {
      break;
    }
  }

  // Diagnostic logging after all attempts / deadline
  console.error('[OCR Failure Diagnostic after attempts]', {
    ocrPath: ocrMode,
    fileSizeBytes,
    fileSizeMB,
    elapsedMs: Date.now() - startTime,
    encountered503,
    modelAttempts,
  });

  if (encountered503) {
    throw new OcrError(
      "Google's AI servers are temporarily busy. Please try again in a few minutes.",
      503,
      { fileSizeBytes, fileSizeMB, ocrMode, modelAttempts }
    );
  }

  const allEmpty = modelAttempts.every((a) => a.outcome === 'empty');
  if (allEmpty && modelAttempts.length > 0) {
    throw new OcrError(
      `OCR completed but returned 0 text characters from this PDF (${fileSizeMB} MB, ${ocrMode.toUpperCase()} path). The file may be blank, unreadable, or corrupted.`,
      422,
      { fileSizeBytes, fileSizeMB, ocrMode, modelAttempts }
    );
  }

  const firstError = modelAttempts.find((a) => a.outcome === 'error');
  const lastAttempt = modelAttempts[modelAttempts.length - 1];
  const primaryErrorText = firstError?.message || lastAttempt?.message || 'Unknown model error or deadline exceeded';

  throw new OcrError(
    `OCR failed across models (${models.join(' → ')}): ${primaryErrorText} (${fileSizeMB} MB, ${ocrMode.toUpperCase()} path)`,
    502,
    { fileSizeBytes, fileSizeMB, ocrMode, modelAttempts }
  );
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed. Please use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const result = await performOcr({ pdfBase64: body.pdfBase64, imagesBase64: body.imagesBase64 });
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
