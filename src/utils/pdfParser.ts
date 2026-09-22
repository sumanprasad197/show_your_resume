import * as pdfjsLib from 'pdfjs-dist';

// Attempt to resolve local Vite-bundled worker, with CDN fallback if required
try {
  // @ts-ignore - Vite ?url query import
  import('pdfjs-dist/build/pdf.worker.min.mjs?url').then((mod) => {
    if (mod && mod.default) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = mod.default;
    }
  }).catch(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  });
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export async function extractTextFromPdf(file: File): Promise<{ text: string; pageCount: number }> {
  // Ensure workerSrc is set
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  let fullText = '';

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ');
    fullText += pageText + ' ';
  }

  return {
    text: fullText.trim(),
    pageCount,
  };
}
