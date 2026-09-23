import React from 'react';
import { Sparkles, Trash2, AlignLeft } from 'lucide-react';
import { ThemeMode } from '../types';
import { SAMPLE_JOB_DESCRIPTION } from '../data/sampleData';

interface JobDescriptionInputProps {
  theme: ThemeMode;
  jobDescription: string;
  onChange: (value: string) => void;
  error: string | null;
  onClearError: () => void;
}

export const JobDescriptionInput: React.FC<JobDescriptionInputProps> = ({
  theme,
  jobDescription,
  onChange,
  error,
  onClearError,
}) => {
  const isDark = theme === 'dark';
  const wordCount = jobDescription.trim() ? jobDescription.trim().split(/\s+/).length : 0;
  const charCount = jobDescription.length;

  const handleInsertSample = () => {
    onClearError();
    onChange(SAMPLE_JOB_DESCRIPTION);
  };

  const handleClear = () => {
    onClearError();
    onChange('');
  };

  return (
    <div id="job-description-container" className="w-full">
      <div className="flex items-center justify-between mb-2">
        <label
          htmlFor="job-description-textarea"
          className={`text-sm font-semibold tracking-tight ${
            isDark ? 'text-neutral-200' : 'text-neutral-800'
          }`}
        >
          Job Description
        </label>
        <div className="flex items-center gap-2">
          {!jobDescription && (
            <button
              id="insert-sample-job-btn"
              type="button"
              onClick={handleInsertSample}
              className={`text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-neutral-400 hover:text-neutral-200 bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800'
                  : 'text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300'
              }`}
            >
              <Sparkles className="w-3 h-3 text-neutral-400" />
              <span>Try with sample job desc</span>
            </button>
          )}
          {jobDescription && (
            <button
              id="clear-job-description-btn"
              type="button"
              onClick={handleClear}
              className={`text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-neutral-400 hover:text-neutral-200 bg-neutral-900/40 hover:bg-neutral-800'
                  : 'text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200'
              }`}
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      <div
        className={`relative p-3 rounded-2xl transition-all duration-300 ${
          isDark ? 'glass-panel-dark' : 'glass-panel-light'
        } ${error ? (isDark ? 'border-red-900/60' : 'border-red-300') : ''}`}
      >
        <textarea
          id="job-description-textarea"
          rows={7}
          value={jobDescription}
          onChange={(e) => {
            onClearError();
            onChange(e.target.value);
          }}
          placeholder="Paste the target job description here, including required skills, qualifications, responsibilities, and seniority level..."
          className={`w-full bg-transparent border-0 resize-y text-sm sm:text-base outline-none leading-relaxed transition-colors placeholder:text-neutral-500 ${
            isDark ? 'text-neutral-100' : 'text-neutral-900'
          }`}
        />

        {/* Word count and status footer */}
        <div
          className={`flex items-center justify-between pt-2 border-t text-xs ${
            isDark
              ? 'border-neutral-800/80 text-neutral-500'
              : 'border-neutral-200/80 text-neutral-500'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlignLeft className="w-3.5 h-3.5" />
            <span>
              {wordCount} {wordCount === 1 ? 'word' : 'words'} ({charCount} chars)
            </span>
          </div>
          {jobDescription && wordCount < 15 && (
            <span className="text-amber-500 font-medium">A longer description yields a more accurate ATS score</span>
          )}
        </div>
      </div>

      {error && (
        <p id="job-description-error" className="text-xs text-red-500 mt-2 font-medium">
          {error}
        </p>
      )}
    </div>
  );
};
