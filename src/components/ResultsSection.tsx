import React, { useState } from 'react';
import { CircularGauge } from './CircularGauge';
import { AnalysisResult, ThemeMode } from '../types';
import { CheckCircle, AlertTriangle, Lightbulb, RotateCcw, Copy, Check, Filter } from 'lucide-react';

interface ResultsSectionProps {
  results: AnalysisResult;
  theme: ThemeMode;
  onReset: () => void;
}

export const ResultsSection: React.FC<ResultsSectionProps> = ({
  results,
  theme,
  onReset,
}) => {
  const isDark = theme === 'dark';
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);
  const [resolvedSuggestions, setResolvedSuggestions] = useState<Record<number, boolean>>({});
  const [searchFilter, setSearchFilter] = useState<string>('');

  const handleCopy = (keyword: string) => {
    navigator.clipboard.writeText(keyword);
    setCopiedKeyword(keyword);
    setTimeout(() => setCopiedKeyword(null), 1800);
  };

  const toggleResolved = (index: number) => {
    setResolvedSuggestions((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const resolvedCount = Object.values(resolvedSuggestions).filter(Boolean).length;
  const totalSuggestions = results.suggestions.length;

  const filteredMatched = results.matched_keywords.filter((kw) =>
    kw.toLowerCase().includes(searchFilter.toLowerCase().trim())
  );
  const filteredMissing = results.missing_keywords.filter((kw) =>
    kw.toLowerCase().includes(searchFilter.toLowerCase().trim())
  );

  return (
    <section id="results-section" className="w-full max-w-5xl mx-auto space-y-8 animate-fadeIn scroll-mt-24">
      {/* Gauge Hero Glass Panel */}
      <div
        id="match-score-card"
        className={`p-6 sm:p-8 rounded-3xl transition-all duration-300 text-center relative overflow-hidden ${
          isDark ? 'glass-panel-dark' : 'glass-panel-light'
        }`}
      >
        {/* Subtle decorative background gradient accent */}
        <div
          className={`absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20 ${
            results.overall_score >= 75
              ? 'bg-emerald-500'
              : results.overall_score >= 50
              ? 'bg-amber-500'
              : 'bg-rose-500'
          }`}
        />

        <div className="max-w-xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2 border border-neutral-700/40 bg-neutral-800/40 text-neutral-300">
            <span>ATS Compatibility Analysis</span>
          </div>
          <h2
            className={`text-xl sm:text-2xl font-bold tracking-tight mb-1 ${
              isDark ? 'text-white' : 'text-neutral-950'
            }`}
          >
            Candidate Match Score
          </h2>
          <p
            className={`text-xs sm:text-sm mb-6 ${
              isDark ? 'text-neutral-400' : 'text-neutral-600'
            }`}
          >
            Synthesized across critical skill overlaps, role domain requirements, and recruiter filtering criteria.
          </p>

          <CircularGauge score={results.overall_score} theme={theme} />
        </div>
      </div>

      {/* Interactive Keyword Search / Filter Bar */}
      {(results.matched_keywords.length > 5 || results.missing_keywords.length > 5) && (
        <div className="flex items-center justify-between gap-4 px-2">
          <div className="relative flex-1 max-w-xs">
            <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter keywords..."
              className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl transition-all border outline-none ${
                isDark
                  ? 'bg-neutral-900/60 border-neutral-800 text-neutral-200 placeholder-neutral-500 focus:border-neutral-600'
                  : 'bg-white border-neutral-300 text-neutral-800 placeholder-neutral-400 focus:border-neutral-400'
              }`}
            />
          </div>
          <span className="text-[11px] text-neutral-400">
            Click any skill tag to copy
          </span>
        </div>
      )}

      {/* Two Glass Cards: Matched Skills & Missing Keywords */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card A: Matched Skills */}
        <div
          id="matched-skills-card"
          className={`p-6 sm:p-7 rounded-3xl transition-all duration-300 flex flex-col hover:border-emerald-500/30 ${
            isDark ? 'glass-panel-dark' : 'glass-panel-light'
          }`}
        >
          <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-800/40 dark:border-neutral-800/60 light:border-neutral-200">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isDark
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                <CheckCircle className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <h3
                  className={`text-base font-bold tracking-tight ${
                    isDark ? 'text-white' : 'text-neutral-950'
                  }`}
                >
                  Matched Skills
                </h3>
                <p
                  className={`text-xs ${
                    isDark ? 'text-neutral-400' : 'text-neutral-600'
                  }`}
                >
                  Found in both your resume & job description
                </p>
              </div>
            </div>
            <span
              id="matched-skills-count"
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                isDark
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}
            >
              {results.matched_keywords.length} found
            </span>
          </div>

          {filteredMatched.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {filteredMatched.map((skill, idx) => (
                <button
                  type="button"
                  key={`${skill}-${idx}`}
                  onClick={() => handleCopy(skill)}
                  title="Click to copy skill"
                  className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer ${
                    isDark
                      ? 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/50 hover:border-emerald-600'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 hover:border-emerald-400'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="whitespace-nowrap">{skill}</span>
                  {copiedKeyword === skill ? (
                    <Check className="w-3 h-3 text-emerald-400 ml-1" />
                  ) : (
                    <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity ml-0.5" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p
              className={`text-sm italic py-4 ${
                isDark ? 'text-neutral-500' : 'text-neutral-500'
              }`}
            >
              {searchFilter
                ? 'No matching skills found in filter.'
                : 'No direct matching keywords detected. Check the job description and resume formatting.'}
            </p>
          )}
        </div>

        {/* Card B: Missing Keywords */}
        <div
          id="missing-keywords-card"
          className={`p-6 sm:p-7 rounded-3xl transition-all duration-300 flex flex-col hover:border-rose-500/30 ${
            isDark ? 'glass-panel-dark' : 'glass-panel-light'
          }`}
        >
          <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-800/40 dark:border-neutral-800/60 light:border-neutral-200">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isDark
                    ? 'bg-rose-950/60 text-rose-400 border border-rose-800/50'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <h3
                  className={`text-base font-bold tracking-tight ${
                    isDark ? 'text-white' : 'text-neutral-950'
                  }`}
                >
                  Missing Keywords
                </h3>
                <p
                  className={`text-xs ${
                    isDark ? 'text-neutral-400' : 'text-neutral-600'
                  }`}
                >
                  Demanded in job description but missing in resume
                </p>
              </div>
            </div>
            <span
              id="missing-keywords-count"
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                isDark
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                  : 'bg-rose-100 text-rose-900 border border-rose-300'
              }`}
            >
              {results.missing_keywords.length} gaps
            </span>
          </div>

          {filteredMissing.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {filteredMissing.map((skill, idx) => (
                <button
                  type="button"
                  key={`${skill}-${idx}`}
                  onClick={() => handleCopy(skill)}
                  title="Click to copy keyword"
                  className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer ${
                    isDark
                      ? 'bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50 hover:border-rose-600'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 hover:border-rose-400'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="whitespace-nowrap">{skill}</span>
                  {copiedKeyword === skill ? (
                    <Check className="w-3 h-3 text-rose-400 ml-1" />
                  ) : (
                    <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity ml-0.5" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm italic py-4 text-emerald-500 font-medium">
              {searchFilter
                ? 'No missing keywords match filter.'
                : 'Exceptional match! No prominent required keywords were flagged as missing.'}
            </p>
          )}
        </div>
      </div>

      {/* Card C: Recruiter's Suggestions with interactive action checklist */}
      <div
        id="recruiters-suggestions-card"
        className={`p-6 sm:p-8 rounded-3xl transition-all duration-300 ${
          isDark ? 'glass-panel-dark' : 'glass-panel-light'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-neutral-800/40 dark:border-neutral-800/60 light:border-neutral-200">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isDark
                  ? 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              <Lightbulb className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3
                className={`text-base sm:text-lg font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-neutral-950'
                }`}
              >
                Recruiter's Actionable Suggestions
              </h3>
              <p
                className={`text-xs ${
                  isDark ? 'text-neutral-400' : 'text-neutral-600'
                }`}
              >
                High-impact edits to pass initial screening algorithms
              </p>
            </div>
          </div>

          {/* Interactive progress badge */}
          {totalSuggestions > 0 && (
            <div
              className={`text-xs px-3 py-1 rounded-full border self-start sm:self-auto transition-colors ${
                resolvedCount === totalSuggestions
                  ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                  : isDark
                  ? 'bg-neutral-800/80 border-neutral-700/60 text-neutral-300'
                  : 'bg-neutral-100 border-neutral-300 text-neutral-700'
              }`}
            >
              {resolvedCount}/{totalSuggestions} improvements marked complete
            </div>
          )}
        </div>

        <div className="space-y-3.5">
          {results.suggestions.map((suggestion, idx) => {
            const isResolved = Boolean(resolvedSuggestions[idx]);
            return (
              <div
                key={idx}
                onClick={() => toggleResolved(idx)}
                className={`group flex items-start gap-4 p-4 rounded-2xl transition-all duration-200 cursor-pointer border ${
                  isResolved
                    ? isDark
                      ? 'bg-emerald-950/20 border-emerald-800/40 opacity-75'
                      : 'bg-emerald-50/50 border-emerald-200 opacity-75'
                    : isDark
                    ? 'bg-neutral-900/60 hover:bg-neutral-900 border-neutral-800/70 hover:border-neutral-700'
                    : 'bg-white/80 hover:bg-white border-neutral-200 hover:border-neutral-300 shadow-xs'
                }`}
              >
                {/* Interactive Checkbox / Number Tag */}
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold transition-all duration-200 ${
                    isResolved
                      ? 'bg-emerald-500 text-black shadow-xs'
                      : isDark
                      ? 'bg-neutral-800 text-neutral-300 border border-neutral-700 group-hover:bg-neutral-700'
                      : 'bg-neutral-100 text-neutral-800 border border-neutral-300 group-hover:bg-neutral-200'
                  }`}
                >
                  {isResolved ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-sm leading-relaxed ${
                      isResolved
                        ? isDark
                          ? 'text-neutral-400 line-through'
                          : 'text-neutral-500 line-through'
                        : isDark
                        ? 'text-neutral-200'
                        : 'text-neutral-800'
                    }`}
                  >
                    {suggestion}
                  </p>
                  <span className="text-[11px] text-neutral-500 mt-1 inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                    {isResolved ? 'Click to unmark' : 'Click to mark as resolved'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Button: Analyze Another Resume */}
      <div className="pt-4 pb-12 flex justify-center">
        <button
          id="analyze-another-button"
          type="button"
          onClick={onReset}
          className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200 cursor-pointer shadow-lg active:scale-95 ${
            isDark
              ? 'bg-white hover:bg-neutral-200 text-black shadow-white/5'
              : 'bg-neutral-900 hover:bg-neutral-800 text-white shadow-neutral-900/10'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Analyze another resume</span>
        </button>
      </div>
    </section>
  );
};
