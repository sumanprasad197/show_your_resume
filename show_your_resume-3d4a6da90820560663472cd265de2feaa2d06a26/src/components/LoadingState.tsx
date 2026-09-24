import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { ThemeMode } from '../types';

interface LoadingStateProps {
  theme: ThemeMode;
  currentStage?: number;
}

const STAGES = [
  'Parsing resume qualifications & career history...',
  'Parsing job description & filtering noise...',
  'Matching core competencies & requirements...',
  'Computing deterministic weighted ATS score...',
  'Writing recruiter suggestions & narrative verdict...',
];

export const LoadingState: React.FC<LoadingStateProps> = ({ theme, currentStage = 0 }) => {
  const isDark = theme === 'dark';
  const stageIdx = Math.min(STAGES.length - 1, Math.max(0, currentStage));
  const isAllComplete = currentStage >= STAGES.length;

  return (
    <div
      id="analysis-loading-card"
      className={`w-full max-w-2xl mx-auto p-8 sm:p-10 rounded-3xl text-center transition-all duration-300 scroll-mt-24 ${
        isDark ? 'glass-panel-dark' : 'glass-panel-light'
      }`}
    >
      <div className="flex flex-col items-center justify-center">
        <div
          className={`relative w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 ${
            isAllComplete
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : isDark
              ? 'bg-neutral-900 border border-neutral-700/80 text-white'
              : 'bg-neutral-200 border border-neutral-300 text-neutral-900'
          }`}
        >
          {isAllComplete ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          ) : (
            <Loader2 className="w-8 h-8 animate-spin" />
          )}
        </div>

        <h3
          id="loading-main-text"
          className={`text-xl sm:text-2xl font-bold tracking-tight mb-2 transition-colors duration-300 ${
            isAllComplete
              ? 'text-emerald-400'
              : isDark
              ? 'text-white'
              : 'text-neutral-950'
          }`}
        >
          {isAllComplete ? 'Analysis complete — preparing report...' : STAGES[stageIdx]}
        </h3>

        <p
          className={`text-xs sm:text-sm max-w-md mx-auto mb-6 ${
            isDark ? 'text-neutral-400' : 'text-neutral-600'
          }`}
        >
          {isAllComplete
            ? 'All 5 strict recruiter ATS evaluation stages passed. Finalizing metrics report...'
            : 'Our multi-stage pipeline is parsing qualifications, running noise-filtered matching, and calculating deterministic weighted scores.'}
        </p>

        {/* Progress Stages Checklist */}
        <div className="w-full max-w-md text-left space-y-2.5 pt-4 border-t border-neutral-800/40 dark:border-neutral-800/60 light:border-neutral-200">
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStage;
            const isCurrent = idx === currentStage && !isAllComplete;

            return (
              <div
                key={stage}
                className={`flex items-center gap-2.5 text-xs sm:text-sm transition-colors duration-200 ${
                  isCompleted
                    ? 'text-emerald-500 font-medium'
                    : isCurrent
                    ? isDark
                      ? 'text-neutral-200 font-medium'
                      : 'text-neutral-900 font-medium'
                    : isDark
                    ? 'text-neutral-600'
                    : 'text-neutral-400'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin text-neutral-400" />
                ) : (
                  <div
                    className={`w-4 h-4 rounded-full border shrink-0 ${
                      isDark ? 'border-neutral-700' : 'border-neutral-300'
                    }`}
                  />
                )}
                <span className="truncate">{stage}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
