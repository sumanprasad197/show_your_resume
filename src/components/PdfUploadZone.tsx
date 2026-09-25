import React, { useRef, useState } from 'react';
import { UploadCloud, FileCheck, AlertCircle, Trash2, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { extractTextFromPdf } from '../utils/pdfParser';
import { requestOcrForPdf } from '../utils/ocrService';
import { UploadedPdfInfo, ThemeMode } from '../types';
import { SAMPLE_RESUME_TEXT } from '../data/sampleData';

interface PdfUploadZoneProps {
  theme: ThemeMode;
  uploadedPdf: UploadedPdfInfo | null;
  onPdfUploaded: (pdfInfo: UploadedPdfInfo | null) => void;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
}

export const PdfUploadZone: React.FC<PdfUploadZoneProps> = ({
  theme,
  uploadedPdf,
  onPdfUploaded,
  errorMessage,
  setErrorMessage,
}) => {
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<string>('Extracting text from PDF...');
  const [extractionSubtext, setExtractionSubtext] = useState<string>('Processing document pages with pdf.js');

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);

    if (!file) {
      console.warn('PDF upload: No file selected');
      setErrorMessage('No file was selected. Please choose a resume PDF.');
      return;
    }

    if (file.size === 0) {
      console.warn('PDF upload: Selected file is 0 bytes:', file.name);
      setErrorMessage('The selected file is empty (0 bytes). Please upload a valid resume PDF.');
      return;
    }

    const fileName = (file.name || '').toLowerCase();
    const fileType = (file.type || '').toLowerCase();

    // Accept if MIME is application/pdf (or application/x-pdf) OR filename ends with .pdf
    // Never reject based on MIME type alone (e.g. Android file managers reporting application/octet-stream)
    const isPdf =
      fileName.endsWith('.pdf') ||
      fileType === 'application/pdf' ||
      fileType === 'application/x-pdf';

    if (!isPdf) {
      console.warn(`PDF upload rejected: name="${file.name}", type="${file.type}". Not recognized as PDF.`);
      setErrorMessage('Please upload a valid PDF document (.pdf).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      console.warn(`PDF upload rejected: file size ${file.size} exceeds 15MB limit`);
      setErrorMessage('PDF file is too large (max 15MB). Please upload a smaller resume file.');
      return;
    }

    try {
      setIsExtracting(true);
      setExtractionStatus('Extracting text from PDF...');
      setExtractionSubtext('Processing document pages with pdf.js');

      let text = '';
      let pageCount = 1;
      let clientExtractFailed = false;

      // Stage 1: Attempt client-side PDF text extraction
      try {
        const clientResult = await extractTextFromPdf(file);
        text = clientResult.text || '';
        pageCount = clientResult.pageCount || 1;
      } catch (clientErr: any) {
        console.warn('Client-side pdf.js extraction failed, checking for OCR fallback:', clientErr);
        const isPassword =
          clientErr?.name === 'PasswordException' ||
          String(clientErr?.message || '').toLowerCase().includes('password');

        if (isPassword) {
          setErrorMessage('This PDF is password-protected. Please upload an unprotected PDF version of your resume.');
          onPdfUploaded(null);
          return;
        }
        clientExtractFailed = true;
      }

      // Stage 2: If extracted text is under ~100 characters or client extraction failed,
      // treat as a scanned/image PDF and invoke the Gemini OCR fallback endpoint
      const isScannedPdf = clientExtractFailed || !text || text.trim().length < 100;

      if (isScannedPdf) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        // Enforce 10 MB limit for scanned OCR route
        if (file.size > 10 * 1024 * 1024) {
          console.warn(`Scanned PDF "${file.name}" exceeds 10 MB limit for OCR: ${file.size} bytes`);
          setErrorMessage(
            `This scanned PDF is over 10 MB (${sizeMB} MB). Please try a text-based version or compress the PDF to under 10 MB.`
          );
          onPdfUploaded(null);
          return;
        }

        // Show visible OCR loading state
        setExtractionStatus('Reading scanned PDF...');
        setExtractionSubtext('Using AI OCR to extract resume text');

        // While retrying, update loading state so the user knows it's working
        const retryTimer = setTimeout(() => {
          setExtractionStatus("Google's servers are busy — retrying...");
          setExtractionSubtext('Waiting for AI capacity and retrying...');
        }, 3000);

        try {
          const ocrText = await requestOcrForPdf(file);
          if (!ocrText || ocrText.trim().length === 0) {
            throw new Error(`OCR completed but returned 0 characters (${sizeMB} MB file).`);
          }
          text = ocrText;
        } catch (ocrErr: any) {
          console.error('OCR fallback extraction error for file:', file.name, ocrErr);
          const rawMsg = ocrErr?.message || '';
          const isBusy =
            rawMsg.includes('temporarily busy') ||
            rawMsg.includes('503') ||
            rawMsg.includes('UNAVAILABLE') ||
            rawMsg.includes('high demand');
          const errorMsg = isBusy
            ? "Google's AI servers are temporarily busy. Please try again in a few minutes."
            : rawMsg || 'OCR extraction failed for this PDF.';
          setErrorMessage(errorMsg);
          onPdfUploaded(null);
          return;
        } finally {
          clearTimeout(retryTimer);
        }
      }

      onPdfUploaded({
        name: file.name,
        size: file.size,
        pageCount,
        text,
      });
    } catch (err: any) {
      console.error('Unhandled PDF upload error for file:', file.name, err);
      const errorMsg = err?.message || 'Unable to process this PDF file. Please try another text-based PDF.';
      setErrorMessage(errorMsg);
      onPdfUploaded(null);
    } finally {
      setIsExtracting(false);
      setExtractionStatus('Extracting text from PDF...');
      setExtractionSubtext('Processing document pages with pdf.js');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
    // Reset value so re-uploading the same file works reliably on iOS/macOS
    e.target.value = '';
  };

  const handleRemove = () => {
    onPdfUploaded(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLoadSampleResume = () => {
    setErrorMessage(null);
    onPdfUploaded({
      name: 'Sample_Alex_Morgan_Senior_FullStack_Resume.pdf',
      size: 148200,
      pageCount: 2,
      text: SAMPLE_RESUME_TEXT,
    });
  };

  return (
    <div id="pdf-upload-container" className="w-full">
      <div className="flex items-center justify-between mb-2">
        <label
          htmlFor="resume-file-input"
          className={`text-sm font-semibold tracking-tight ${
            isDark ? 'text-neutral-200' : 'text-neutral-800'
          }`}
        >
          Resume PDF
        </label>
        {!uploadedPdf && !isExtracting && (
          <button
            id="load-sample-resume-btn"
            type="button"
            onClick={handleLoadSampleResume}
            className={`text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? 'text-neutral-400 hover:text-neutral-200 bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800'
                : 'text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300'
            }`}
          >
            <Sparkles className="w-3 h-3 text-neutral-400" />
            <span>Try with Sample</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        id="resume-file-input"
        type="file"
        accept=".pdf,.PDF,application/pdf,application/x-pdf,application/octet-stream"
        onChange={handleFileInputChange}
        className="sr-only"
        tabIndex={-1}
      />

      {/* Upload Box or Uploaded State */}
      {uploadedPdf ? (
        <div
          id="uploaded-file-card"
          className={`p-5 rounded-2xl transition-all duration-300 ${
            isDark ? 'glass-panel-dark' : 'glass-panel-light'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  isDark
                    ? 'bg-neutral-800 text-emerald-400 border border-neutral-700/80'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                <FileCheck className="w-6 h-6 stroke-[1.8]" />
              </div>
              <div className="min-w-0">
                <h2
                  className={`text-sm sm:text-base font-semibold truncate ${
                    isDark ? 'text-neutral-100' : 'text-neutral-900'
                  }`}
                  title={uploadedPdf.name}
                >
                  {uploadedPdf.name}
                </h2>
                <div
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1 ${
                    isDark ? 'text-neutral-400' : 'text-neutral-600'
                  }`}
                >
                  <span>{formatFileSize(uploadedPdf.size)}</span>
                  <span>•</span>
                  <span>
                    {uploadedPdf.pageCount} {uploadedPdf.pageCount === 1 ? 'page' : 'pages'}
                  </span>
                  <span>•</span>
                  <span className="text-emerald-500 font-medium">Text parsed successfully</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                id="replace-pdf-button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Replace with another PDF"
                className={`p-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Replace</span>
              </button>
              <button
                id="remove-pdf-button"
                type="button"
                onClick={handleRemove}
                title="Remove resume PDF"
                className={`p-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-neutral-900/90 hover:bg-red-950/40 text-neutral-400 hover:text-red-400 border border-neutral-800 hover:border-red-800/40'
                    : 'bg-neutral-100 hover:bg-red-50 text-neutral-600 hover:text-red-700 border border-neutral-300 hover:border-red-200'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Remove</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          id="pdf-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isExtracting && fileInputRef.current?.click()}
          className={`group p-8 rounded-2xl text-center cursor-pointer transition-all duration-200 ${
            isDark ? 'glass-upload-dark' : 'glass-upload-light'
          } ${
            isDragging
              ? isDark
                ? 'border-neutral-300 bg-neutral-800/40'
                : 'border-neutral-600 bg-neutral-200/50'
              : isDark
              ? 'hover:border-neutral-500 hover:bg-white/[0.04]'
              : 'hover:border-neutral-400 hover:bg-black/[0.02]'
          }`}
        >
          {isExtracting ? (
            <div className="flex flex-col items-center justify-center py-4">
              <Loader2
                className={`w-10 h-10 animate-spin mb-3 ${
                  isDark ? 'text-neutral-300' : 'text-neutral-700'
                }`}
              />
              <p
                className={`text-sm font-medium ${
                  isDark ? 'text-neutral-200' : 'text-neutral-800'
                }`}
              >
                {extractionStatus}
              </p>
              <p
                className={`text-xs mt-1 ${
                  isDark ? 'text-neutral-500' : 'text-neutral-500'
                }`}
              >
                {extractionSubtext}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 ${
                  isDark
                    ? 'bg-neutral-900 border border-neutral-700/80 text-neutral-300'
                    : 'bg-neutral-200/80 border border-neutral-300 text-neutral-700'
                }`}
              >
                <UploadCloud className="w-6 h-6 stroke-[1.8]" />
              </div>
              <p
                className={`text-sm sm:text-base font-semibold ${
                  isDark ? 'text-neutral-200' : 'text-neutral-800'
                }`}
              >
                Drop your resume PDF here, or{' '}
                <span className="underline underline-offset-4">click to browse</span>
              </p>
              <p
                className={`text-xs mt-1.5 ${
                  isDark ? 'text-neutral-500' : 'text-neutral-500'
                }`}
              >
                PDF format only • Client-side text parsing • Up to 15MB
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error Message if any */}
      {errorMessage && (
        <div
          id="pdf-error-banner"
          className={`flex items-start gap-2.5 p-3.5 mt-3 rounded-xl text-xs sm:text-sm border transition-all ${
            isDark
              ? 'bg-red-950/30 border-red-900/60 text-red-300'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}
    </div>
  );
};
