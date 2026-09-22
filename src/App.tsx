import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PdfUploadZone } from './components/PdfUploadZone';
import { JobDescriptionInput } from './components/JobDescriptionInput';
import { LoadingState } from './components/LoadingState';
import { ResultsSection } from './components/ResultsSection';
import { BackgroundGradients } from './components/BackgroundGradients';
import { UploadedPdfInfo, AnalysisResult, ThemeMode } from './types';
import { Sparkles, AlertCircle, CheckCircle2, Github, Instagram } from 'lucide-react';

// Profile links for Suman Prasad Sahoo
const GITHUB_PROFILE_URL = 'https://github.com/sumanprasad197';
const INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/sumxnprxsxd._?stkn=YThzMzhtNzZnaTVi';

export default function App() {
  // Theme state: dark-first with pure black (#000000), persisting to localStorage
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('syr_theme');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    }
    return 'dark';
  });

  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfInfo | null>(null);
  const [jobDescription, setJobDescription] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Sync theme to localStorage and document root
  useEffect(() => {
    localStorage.setItem('syr_theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      document.body.style.backgroundColor = '#000000';
      document.body.style.color = '#ededed';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      document.body.style.backgroundColor = '#f3f4f6';
      document.body.style.color = '#111827';
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Determine current step for the 3-step strip
  const currentStep: 1 | 2 | 3 = results ? 3 : jobDescription.trim().length >= 30 ? 2 : 1;

  const isDark = theme === 'dark';
  const canAnalyze = Boolean(uploadedPdf && uploadedPdf.text.trim().length > 0 && jobDescription.trim().length > 0);

  const handleAnalyze = async () => {
    setPdfError(null);
    setJobError(null);
    setApiError(null);

    if (!uploadedPdf || !uploadedPdf.text.trim()) {
      setPdfError('Please upload your resume PDF first.');
      return;
    }

    if (uploadedPdf.text.trim().length < 40) {
      setPdfError('This looks like a scanned PDF — try a text-based version');
      return;
    }

    const trimmedJob = jobDescription.trim();
    if (!trimmedJob || trimmedJob.length < 30) {
      setJobError(
        'Job description is too short. Please paste at least a couple of sentences or the job requirements to perform an accurate ATS match.'
      );
      return;
    }

    setIsAnalyzing(true);
    setResults(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeText: uploadedPdf.text,
          jobDescription: trimmedJob,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        await response.text();
        throw new Error(
          response.status === 404
            ? 'Endpoint not found (/api/analyze). Please ensure your deployment has active API routes.'
            : `Server returned an unexpected response (${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to analyze resume. Please try again.');
      }

      setResults(data);

      // Scroll smoothly down to results
      setTimeout(() => {
        const resultsEl = document.getElementById('results-section');
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setApiError(
        err?.message ||
          'A temporary error occurred while analyzing your resume. Please check your inputs and try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setUploadedPdf(null);
    setJobDescription('');
    setResults(null);
    setPdfError(null);
    setJobError(null);
    setApiError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className={`min-h-screen relative transition-colors duration-300 flex flex-col justify-between ${
        isDark ? 'bg-black text-neutral-100' : 'bg-[#f3f4f6] text-neutral-900'
      }`}
    >
      {/* Background Gradients & Ambient Visual Accents */}
      <BackgroundGradients theme={theme} />

      {/* Main Foreground Container */}
      <div className="w-full flex-1 relative z-10">
        {/* Top Header & Lowercase Centered Hero Line */}
        <Header
          theme={theme}
          onToggleTheme={toggleTheme}
          currentStep={currentStep}
          onHomeClick={handleReset}
        />

        {/* Main Content Area */}
        <main className="w-full max-w-5xl mx-auto px-4 pb-16">
          {/* Input Section (Upload + Job Description + Analyze Button) */}
          {!results && !isAnalyzing && (
            <div className="space-y-6">
              {/* PDF Upload Zone */}
              <PdfUploadZone
                theme={theme}
                uploadedPdf={uploadedPdf}
                onPdfUploaded={(info) => {
                  setUploadedPdf(info);
                  setPdfError(null);
                }}
                errorMessage={pdfError}
                setErrorMessage={setPdfError}
              />

              {/* Job Description Text Area */}
              <JobDescriptionInput
                theme={theme}
                jobDescription={jobDescription}
                onChange={(val) => {
                  setJobDescription(val);
                  if (jobError) setJobError(null);
                }}
                error={jobError}
                onClearError={() => setJobError(null)}
              />

              {/* API Level Error Banner if any */}
              {apiError && (
                <div
                  id="api-error-banner"
                  className={`flex items-start gap-3 p-4 rounded-2xl text-sm border transition-all ${
                    isDark
                      ? 'bg-rose-950/40 border-rose-900/60 text-rose-200'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Analysis Failed</p>
                    <p className="text-xs sm:text-sm mt-0.5 opacity-90">{apiError}</p>
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      className="mt-2 text-xs font-semibold underline underline-offset-2 hover:opacity-80 cursor-pointer"
                    >
                      Click here to retry
                    </button>
                  </div>
                </div>
              )}

              {/* Prominent Analyze Button with Interactive State Indicator */}
              <div className="pt-2 flex flex-col items-center">
                {canAnalyze && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-1 rounded-full text-xs font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 animate-pulse">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Inputs ready for recruiter scan</span>
                  </div>
                )}

                <button
                  id="analyze-resume-button"
                  type="button"
                  disabled={!canAnalyze || isAnalyzing}
                  onClick={handleAnalyze}
                  className={`w-full sm:w-auto min-w-[300px] flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-bold text-base tracking-tight transition-all duration-300 shadow-xl ${
                    canAnalyze && !isAnalyzing
                      ? isDark
                        ? 'bg-white text-black hover:bg-neutral-200 active:scale-98 cursor-pointer shadow-white/10 hover:shadow-white/20'
                        : 'bg-neutral-950 text-white hover:bg-neutral-800 active:scale-98 cursor-pointer shadow-neutral-950/20'
                      : isDark
                      ? 'bg-neutral-900 text-neutral-600 border border-neutral-800 cursor-not-allowed opacity-60'
                      : 'bg-neutral-200 text-neutral-400 border border-neutral-300 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Analyze Resume with ATS</span>
                </button>

                {!canAnalyze && (
                  <p
                    id="analyze-hint-text"
                    className={`text-xs mt-3 ${
                      isDark ? 'text-neutral-500' : 'text-neutral-500'
                    }`}
                  >
                    {!uploadedPdf && !jobDescription
                      ? 'Upload your resume PDF and paste a job description to activate analysis'
                      : !uploadedPdf
                      ? 'Please upload your resume PDF above'
                      : 'Please paste the job description above'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isAnalyzing && (
            <div className="py-8">
              <LoadingState theme={theme} />
            </div>
          )}

          {/* Results Section */}
          {results && !isAnalyzing && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800/40 dark:border-neutral-800/60 light:border-neutral-200">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Analysis Ready</span>
                </div>
                <button
                  id="quick-reset-btn"
                  type="button"
                  onClick={handleReset}
                  className={`text-xs underline underline-offset-4 cursor-pointer ${
                    isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  Start over with new inputs
                </button>
              </div>

              <ResultsSection results={results} theme={theme} onReset={handleReset} />
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer
        id="app-footer"
        className={`w-full max-w-5xl mx-auto py-6 px-4 sm:px-6 border-t transition-colors relative z-10 flex flex-col md:flex-row items-center justify-between gap-5 md:gap-4 text-xs ${
          isDark
            ? 'border-neutral-900/80 text-neutral-500'
            : 'border-neutral-200 text-neutral-600'
        }`}
      >
        {/* Left Side: Brand Logo + Subtitle */}
        <div className="flex flex-col lg:flex-row items-center md:items-start lg:items-center gap-1.5 md:gap-1 lg:gap-3 text-center md:text-left">
          {/* Logo with clean lowercase "show your" and bold uppercase "RESUME" - identical style, animation, and color scheme as header */}
          <button
            id="footer-brand-logo"
            type="button"
            onClick={handleReset}
            title="Go to Home"
            aria-label="Show Your Resume Home"
            className="inline-flex items-baseline gap-2 select-none cursor-pointer bg-transparent border-0 p-0 text-left transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 rounded-md"
          >
            <span
              className={`text-sm font-semibold tracking-widest lowercase ${
                isDark ? 'titanium-dark-deep' : 'titanium-light-deep'
              }`}
            >
              show your
            </span>
            <span
              className={`font-black tracking-wider text-xl leading-none uppercase ${
                isDark ? 'titanium-dark-silver' : 'titanium-light-silver'
              }`}
            >
              RESUME
            </span>
          </button>

          <span className="hidden lg:inline text-neutral-500/60 select-none">•</span>

          <span className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Resume Analyzer with Strict ATS Match Engine
          </span>
        </div>

        {/* Right Side: Made by Suman Prasad Sahoo + Social Icons */}
        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 text-center md:text-right">
          <span className={`text-xs font-medium ${isDark ? 'text-neutral-400' : 'text-neutral-700'}`}>
            Made by Suman Prasad Sahoo
          </span>
          <div className="flex items-center justify-center gap-2">
            <a
              id="footer-github-link"
              href={GITHUB_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Profile"
              title="GitHub Profile"
              className={`p-1.5 rounded-lg border transition-all duration-200 inline-flex items-center justify-center ${
                isDark
                  ? 'border-neutral-800 bg-neutral-900/80 text-neutral-400 hover:text-white hover:border-neutral-700 hover:bg-neutral-800'
                  : 'border-neutral-300 bg-white text-neutral-600 hover:text-neutral-950 hover:border-neutral-400 shadow-xs'
              }`}
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              id="footer-instagram-link"
              href={INSTAGRAM_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram Profile"
              title="Instagram Profile"
              className={`p-1.5 rounded-lg border transition-all duration-200 inline-flex items-center justify-center ${
                isDark
                  ? 'border-neutral-800 bg-neutral-900/80 text-neutral-400 hover:text-pink-400 hover:border-neutral-700 hover:bg-neutral-800'
                  : 'border-neutral-300 bg-white text-neutral-600 hover:text-pink-600 hover:border-neutral-400 shadow-xs'
              }`}
            >
              <Instagram className="w-4 h-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
