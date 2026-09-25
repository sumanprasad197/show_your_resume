import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite asset URL query import
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set same-origin bundled worker immediately for iOS & Safari security compatibility
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export async function extractTextFromPdf(file: File): Promise<{ text: string; pageCount: number }> {
  try {
    // Fallback if not set
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
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
    const pageCount = pdfDoc.numPages;
    let fullText = '';

    for (let i = 1; i <= pageCount; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ');
        fullText += pageText + ' ';
      } catch (pageErr) {
        console.warn(`Error extracting text from page ${i} of ${file.name}:`, pageErr);
      }
    }

    return {
      text: fullText.trim(),
      pageCount,
    };
  } catch (error) {
    console.error('extractTextFromPdf encountered an error for file:', file.name, error);
    throw error;
  }
}
