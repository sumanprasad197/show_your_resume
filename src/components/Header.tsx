import React from 'react';
import { Sun, Moon, ArrowRight, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import { ThemeMode } from '../types';

interface HeaderProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  currentStep: 1 | 2 | 3;
  onHomeClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ theme, onToggleTheme, currentStep, onHomeClick }) => {
  const isDark = theme === 'dark';

  return (
    <header className="w-full max-w-5xl mx-auto mb-10 pt-6 px-4">
      {/* Top Bar: Brand Logo + Theme Toggle */}
      <div className="flex items-center justify-between gap-4 pb-6 border-b border-neutral-800/40 dark:border-neutral-800/60 light:border-neutral-200">
        <div className="flex items-center gap-2">
          {/* Logo with clean lowercase "show your" (no cursive) and bold uppercase "RESUME" - clickable to return home */}
          <button
            id="brand-logo"
            type="button"
            onClick={onHomeClick}
            title="Go to Home"
            aria-label="Show Your Resume Home"
            className="flex items-baseline gap-2 select-none cursor-pointer bg-transparent border-0 p-0 text-left transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 rounded-md"
          >
            <span
              className={`text-sm sm:text-base font-semibold tracking-widest lowercase ${
                isDark ? 'titanium-dark-deep' : 'titanium-light-deep'
              }`}
            >
              show your
            </span>
            <span
              className={`font-black tracking-wider text-xl sm:text-2xl leading-none uppercase ${
                isDark ? 'titanium-dark-silver' : 'titanium-light-silver'
              }`}
            >
              RESUME
            </span>
          </button>
        </div>

        {/* Theme Toggle Button */}
        <button
          id="theme-toggle-button"
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all duration-200 cursor-pointer text-sm font-medium ${
            isDark
              ? 'bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700/70 text-neutral-200 shadow-sm'
              : 'bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-800 shadow-xs'
          }`}
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-neutral-300" />
              <span className="hidden sm:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-neutral-700" />
              <span className="hidden sm:inline">Dark</span>
            </>
          )}
        </button>
      </div>

      {/* Hero Section between Logo and Upload Zone */}
      <div className="py-8 sm:py-10 text-center flex flex-col items-center justify-center">
        {/* Main Header in bigger format, centered, lowercase, with 'scans it' in single matching color */}
        <h2
          id="hero-header-line"
          className={`text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-black tracking-tight leading-[1.15] max-w-3xl lowercase ${
            isDark ? 'text-white' : 'text-neutral-950'
          }`}
        >
          see your resume the way a recruiter{' '}
          <span
            className={`font-black underline underline-offset-8 decoration-2 ${
              isDark
                ? 'titanium-dark-deep decoration-neutral-600'
                : 'titanium-light-deep decoration-neutral-400'
            }`}
          >
            scans it.
          </span>
        </h2>

        {/* Subheading in gray colors, small text, subheading format */}
        <p
          id="hero-subheading"
          className={`text-sm sm:text-base font-normal max-w-xl mx-auto mt-3 sm:mt-4 leading-relaxed lowercase ${
            isDark ? 'text-neutral-400' : 'text-neutral-600'
          }`}
        >
          upload your resume at the role you want and get a clear read on what will make it through the first filter.
        </p>
      </div>

      {/* 3-Step Strip without numbers */}
      <div
        id="steps-strip-container"
        className={`p-2 rounded-2xl transition-all duration-300 ${
          isDark ? 'glass-panel-dark' : 'glass-panel-light'
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 text-sm">
          {/* Step 1: Upload Resume PDF (No numbers) */}
          <div
            id="step-1-indicator"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
              currentStep === 1
                ? isDark
                  ? 'bg-neutral-800/90 text-white font-medium border border-neutral-600/70 shadow-sm'
                  : 'bg-white text-neutral-950 font-medium shadow-sm border border-neutral-300/80'
                : currentStep > 1
                ? isDark
                  ? 'text-neutral-300 bg-neutral-900/40'
                  : 'text-neutral-700 bg-neutral-100/60'
                : isDark
                ? 'text-neutral-500'
                : 'text-neutral-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current shrink-0 opacity-70" />
            <span className="truncate">Upload Resume PDF</span>
            <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-40 hidden md:block" />
          </div>

          {/* Step 2: Job description (No numbers, renamed to "Job description") */}
          <div
            id="step-2-indicator"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
              currentStep === 2
                ? isDark
                  ? 'bg-neutral-800/90 text-white font-medium border border-neutral-600/70 shadow-sm'
                  : 'bg-white text-neutral-950 font-medium shadow-sm border border-neutral-300/80'
                : currentStep > 2
                ? isDark
                  ? 'text-neutral-300 bg-neutral-900/40'
                  : 'text-neutral-700 bg-neutral-100/60'
                : isDark
                ? 'text-neutral-500'
                : 'text-neutral-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current shrink-0 opacity-70" />
            <span className="truncate">Job description</span>
            <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-40 hidden md:block" />
          </div>

          {/* Step 3: ATS Analysis (No numbers) */}
          <div
            id="step-3-indicator"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
              currentStep === 3
                ? isDark
                  ? 'bg-neutral-800/90 text-white font-medium border border-neutral-600/70 shadow-sm'
                  : 'bg-white text-neutral-950 font-medium shadow-sm border border-neutral-300/80'
                : isDark
                ? 'text-neutral-500'
                : 'text-neutral-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current shrink-0 opacity-70" />
            <span className="truncate">ATS Analysis</span>
            <Sparkles className="w-3.5 h-3.5 ml-auto opacity-40 hidden md:block" />
          </div>
        </div>
      </div>
    </header>
  );
};
