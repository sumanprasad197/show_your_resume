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
 * Sends a scanned/image-based PDF to the server-side OCR endpoint.
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

  const pdfBase64 = await fileToBase64(file);

  let response: Response;
  try {
    response = await fetch('/api/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pdfBase64 }),
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
