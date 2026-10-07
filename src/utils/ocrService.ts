import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite asset URL query import
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    pdfWorkerUrl || `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

/**
 * Converts a File object to a clean base64-encoded string without whitespace.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      // Strip any whitespace/newlines
      resolve(base64.replace(/\s+/g, ''));
    };
    reader.onerror = (err) => reject(new Error(`Failed to read PDF file into memory: ${err}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Renders each page of a PDF to a canvas and exports it as a JPEG base64 string
 * (quality ~0.85, scale ~2.0 for legibility). Limited to the first 5 pages.
 */
export async function renderPdfPagesToJpegBase64(file: File, maxPages = 5): Promise<string[]> {
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      pdfWorkerUrl || `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }

  const arrayBuffer = await file.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('PDF file buffer is empty (0 bytes).');
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
    stopAtErrors: false,
  });

  const pdfDoc = await loadingTask.promise;
  const numPagesToRender = Math.min(pdfDoc.numPages, maxPages);
  const imagesBase64: string[] = [];

  for (let pageNum = 1; pageNum <= numPagesToRender; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Could not create 2D canvas context for PDF page rendering.');
    }

    // Fill white background for JPEG rendering (avoid black transparent regions)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport,
      canvas,
    };
    await page.render(renderContext as any).promise;

    // Export as JPEG data URL (quality ~0.85)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    // Strip data-URL prefix ("data:image/jpeg;base64,") and any whitespace
    const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
    imagesBase64.push(cleanBase64);

    // Free canvas memory
    canvas.width = 0;
    canvas.height = 0;
  }

  if (imagesBase64.length === 0) {
    throw new Error('0 pages were rendered from PDF.');
  }

  return imagesBase64;
}

/**
 * Sends a scanned/image-based PDF to the server-side OCR endpoint.
 * First renders pages to JPEG images using pdf.js; falls back to raw PDF base64 if rendering fails.
 * Limited to PDFs under 10 MB.
 */
export async function requestOcrForPdf(file: File): Promise<string> {
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

  // Check 10 MB limit before uploading
  if (file.size > 10 * 1024 * 1024) {
    throw new Error(
      `This scanned PDF is over 10 MB (${sizeMB} MB). Please try a text-based version or compress the PDF to under 10 MB.`
    );
  }

  let imagesBase64: string[] | null = null;
  let pdfBase64: string | null = null;

  try {
    imagesBase64 = await renderPdfPagesToJpegBase64(file, 5);
    console.log(`[OCR Client] Successfully rendered ${imagesBase64.length} page(s) to JPEG (scale 2, quality 0.85).`);
  } catch (renderErr) {
    console.warn('[OCR Client] PDF page rendering to images failed. Falling back to raw PDF base64:', renderErr);
    pdfBase64 = await fileToBase64(file);
  }

  let response: Response;
  try {
    response = await fetch('/api/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imagesBase64: imagesBase64 && imagesBase64.length > 0 ? imagesBase64 : undefined,
        pdfBase64: pdfBase64 || undefined,
      }),
    });
  } catch (netErr: any) {
    console.error('Network error calling /api/ocr:', netErr);
    throw new Error(`Network failure connecting to OCR service: ${netErr?.message || 'Connection failed'}`);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    let errorMsg = data?.error;
    if (!errorMsg) {
      if (response.status === 413) {
        errorMsg = `PDF payload rejected: exceeds transmission size limit (${sizeMB} MB). Please compress the file.`;
      } else if (response.status === 504 || response.status === 502) {
        errorMsg = `OCR server gateway error (HTTP ${response.status}). The model took too long or timed out.`;
      } else {
        errorMsg = `OCR failed with HTTP ${response.status} (${response.statusText || 'Error'}).`;
      }
    }
    throw new Error(errorMsg);
  }

  if (!data?.text || typeof data.text !== 'string' || data.text.trim().length === 0) {
    throw new Error(
      `OCR completed but returned 0 text characters from this PDF (${sizeMB} MB). The file may be blank, unreadable, or corrupted.`
    );
  }

  return data.text.trim();
}
