import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { ThemeMode } from '../types';

interface LoadingStateProps {
  theme: ThemeMode;
}

const STAGES = [
  'Reading your resume...',
  'Extracting core competencies and technical skills...',
  'Cross-referencing requirements against job description...',
  'Evaluating recruiter ATS thresholds and scoring...',
  'Formulating actionable recruiter suggestions...',
];

export const LoadingState: React.FC<LoadingStateProps> = ({ theme }) => {
  const isDark = theme === 'dark';
  const [currentStageIdx, setCurrentStageIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStageIdx((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      id="analysis-loading-card"
      className={`w-full max-w-2xl mx-auto p-8 sm:p-10 rounded-3xl text-center transition-all duration-300 ${
        isDark ? 'glass-panel-dark' : 'glass-panel-light'
      }`}
    >
      <div className="flex flex-col items-center justify-center">
        <div
          className={`relative w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
            isDark
              ? 'bg-neutral-900 border border-neutral-700/80 text-white'
              : 'bg-neutral-200 border border-neutral-300 text-neutral-900'
          }`}
        >
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>

        <h3
          id="loading-main-text"
          className={`text-xl sm:text-2xl font-bold tracking-tight mb-2 ${
            isDark ? 'text-white' : 'text-neutral-950'
          }`}
        >
          {STAGES[currentStageIdx]}
        </h3>

        <p
          className={`text-xs sm:text-sm max-w-md mx-auto mb-6 ${
            isDark ? 'text-neutral-400' : 'text-neutral-600'
          }`}
        >
          Our strict ATS recruiter AI is parsing your qualifications, matching key requirements, and auditing gaps.
        </p>

        {/* Progress Stages Checklist */}
        <div className="w-full max-w-md text-left space-y-2.5 pt-4 border-t border-neutral-800/40 dark:border-neutral-800/60 light:border-neutral-200">
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStageIdx;
            const isCurrent = idx === currentStageIdx;

            return (
              <div
                key={stage}
                className={`flex items-center gap-2.5 text-xs sm:text-sm transition-colors ${
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
