import React, { useState, useEffect } from 'react';
import { CircularGauge } from './CircularGauge';
import { AnalysisResult, ThemeMode } from '../types';
import {
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  RotateCcw,
  Copy,
  Check,
  Filter,
  Download,
  Loader2,
  X,
  ExternalLink,
  Layers,
  Briefcase,
  GraduationCap,
  FileCheck,
  Eye,
  ArrowLeft,
} from 'lucide-react';
import { downloadScoreCardImage, generateScoreCardCanvas } from '../utils/exportScoreCard';
import { ATS_LABELS, CATEGORY_DEFINITIONS } from '../constants/atsConstants';

interface ResultsSectionProps {
  results: AnalysisResult;
  theme: ThemeMode;
  onReset: () => void;
  onBack?: () => void;
}

export const ResultsSection: React.FC<ResultsSectionProps> = ({
  results,
  theme,
  onReset,
  onBack,
}) => {
  const isDark = theme === 'dark';
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);
  const [resolvedSuggestions, setResolvedSuggestions] = useState<Record<number, boolean>>({});
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Export Score Card State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [previewModalDataUrl, setPreviewModalDataUrl] = useState<string | null>(null);

  // Lock background scroll and close on 'Esc' when preview modal is open
  useEffect(() => {
    if (!previewModalDataUrl) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPreviewModalDataUrl(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewModalDataUrl]);

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

  // Default breakdown fallback if legacy result
  const breakdown = results.breakdown || {
    skills: Math.round(results.overall_score * 0.9),
    experience: Math.round(results.overall_score * 0.95),
    education: 90,
    formatting: 95,
  };

  const handlePreviewCard = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await generateScoreCardCanvas({ results, theme });
      setPreviewModalDataUrl(res.dataUrl);
    } catch (err) {
      console.error('Failed to generate preview:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveResults = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const res = await downloadScoreCardImage({
        results,
        theme,
      });

      if (res.isIos) {
        setPreviewModalDataUrl(res.dataUrl);
      } else {
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Failed to export score card:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const categoryIcons: Record<string, typeof Layers> = {
    skills: Layers,
    experience: Briefcase,
    education: GraduationCap,
    formatting: FileCheck,
  };

  const breakdownItems = CATEGORY_DEFINITIONS.map((cat) => ({
    ...cat,
    score: breakdown[cat.id as keyof typeof breakdown] || 80,
    icon: categoryIcons[cat.id] || Layers,
  }));

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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wider mb-2 border border-neutral-700/40 bg-neutral-800/40 text-neutral-300">
            <span>{ATS_LABELS.MAIN_BADGE}</span>
          </div>
          <h2
            className={`text-xl sm:text-2xl font-bold tracking-tight mb-1 ${
              isDark ? 'text-white' : 'text-neutral-950'
            }`}
          >
            {ATS_LABELS.SUBTITLE}
          </h2>
          <p
            className={`text-xs sm:text-sm mb-6 ${
              isDark ? 'text-neutral-400' : 'text-neutral-600'
            }`}
          >
            {ATS_LABELS.DESCRIPTION}
          </p>

          <CircularGauge score={results.overall_score} theme={theme} />

          {/* Save & Preview Results Pill Buttons (Below Score Gauge) */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              id="save-results-button"
              type="button"
              onClick={handleSaveResults}
              disabled={isExporting}
              title="Download high-resolution score card PNG"
              aria-label="Save Results as PNG Image"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer shadow-sm active:scale-95 border ${
                isDark
                  ? 'bg-neutral-900/80 hover:bg-neutral-800/90 text-neutral-200 border-neutral-700/70 hover:border-neutral-500 shadow-black/40'
                  : 'bg-white/90 hover:bg-white text-neutral-800 border-neutral-300 hover:border-neutral-400 shadow-neutral-200'
              }`}
              style={{
                WebkitBackdropFilter: 'blur(10px) saturate(160%)',
                backdropFilter: 'blur(10px) saturate(160%)',
              }}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                  <span>Generating Score Card...</span>
                </>
              ) : exportSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Score Card Saved</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-neutral-400" />
                  <span>Save Results</span>
                </>
              )}
            </button>

            <button
              id="preview-card-button"
              type="button"
              onClick={handlePreviewCard}
              disabled={isExporting}
              title="Preview exported score card image"
              aria-label="Preview Score Card Image"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer shadow-sm active:scale-95 border ${
                isDark
                  ? 'bg-neutral-900/60 hover:bg-neutral-800/80 text-neutral-300 border-neutral-700/50 hover:border-neutral-500'
                  : 'bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700 border-neutral-300 hover:border-neutral-400'
              }`}
              style={{
                WebkitBackdropFilter: 'blur(10px) saturate(160%)',
                backdropFilter: 'blur(10px) saturate(160%)',
              }}
            >
              <Eye className="w-4 h-4 text-neutral-400" />
              <span>Preview Card</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Breakdown Panel */}
      <div
        id="category-breakdown-card"
        className={`p-6 sm:p-7 rounded-3xl transition-all duration-300 ${
          isDark ? 'glass-panel-dark' : 'glass-panel-light'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-neutral-800/40 dark:border-neutral-800/60 light:border-neutral-200">
          <div>
            <h3
              className={`text-base sm:text-lg font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-neutral-950'
              }`}
            >
              {ATS_LABELS.BREAKDOWN_TITLE}
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
              {ATS_LABELS.BREAKDOWN_SUBTITLE}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium self-start sm:self-auto border border-neutral-700/50 bg-neutral-800/50 text-neutral-300">
            <span>Overall: {results.overall_score}/100</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {breakdownItems.map((item) => {
            const Icon = item.icon;
            const scoreColor =
              item.score >= 80 ? 'text-emerald-500' : item.score >= 60 ? 'text-amber-500' : 'text-rose-500';
            const barFill =
              item.score >= 80 ? 'bg-emerald-500' : item.score >= 60 ? 'bg-amber-500' : 'bg-rose-500';

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isDark
                    ? 'bg-neutral-900/40 border-neutral-800/80 hover:border-neutral-700/80'
                    : 'bg-white/60 border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4
                        className={`text-xs sm:text-sm font-semibold tracking-tight ${
                          isDark ? 'text-neutral-200' : 'text-neutral-800'
                        }`}
                      >
                        {item.title}
                      </h4>
                      <span className="text-[11px] text-neutral-500 font-medium">{item.weight}</span>
                    </div>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${scoreColor}`}>
                    {item.score}%
                  </span>
                </div>

                {/* Progress Bar Track */}
                <div
                  className={`w-full h-2 rounded-full overflow-hidden mb-2 ${
                    isDark ? 'bg-neutral-800' : 'bg-neutral-200'
                  }`}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barFill}`}
                    style={{ width: `${Math.max(4, Math.min(100, item.score))}%` }}
                  />
                </div>

                <p className="text-[11px] text-neutral-500 leading-tight">
                  {item.description}
                </p>
              </div>
            );
          })}
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
                  {ATS_LABELS.MATCHED_SKILLS_TITLE}
                </h3>
                <p
                  className={`text-xs ${
                    isDark ? 'text-neutral-400' : 'text-neutral-600'
                  }`}
                >
                  {ATS_LABELS.MATCHED_SKILLS_SUBTITLE}
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
                : 'No direct matching keywords detected.'}
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
                  {ATS_LABELS.MISSING_KEYWORDS_TITLE}
                </h3>
                <p
                  className={`text-xs ${
                    isDark ? 'text-neutral-400' : 'text-neutral-600'
                  }`}
                >
                  {ATS_LABELS.MISSING_KEYWORDS_SUBTITLE}
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
                {ATS_LABELS.SUGGESTIONS_TITLE}
              </h3>
              <p
                className={`text-xs ${
                  isDark ? 'text-neutral-400' : 'text-neutral-600'
                }`}
              >
                {ATS_LABELS.SUGGESTIONS_SUBTITLE}
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

      {/* Action Button: Analyze Another Resume / Edit Inputs */}
      <div className="pt-6 pb-12 flex flex-col sm:flex-row items-center justify-center gap-4">
        {onBack && (
          <button
            id="back-to-inputs-button"
            type="button"
            onClick={onBack}
            className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-sm border transition-all duration-200 cursor-pointer active:scale-95 ${
              isDark
                ? 'border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200'
                : 'border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>Edit current inputs</span>
          </button>
        )}
        <button
          id="analyze-another-button"
          type="button"
          onClick={onReset}
          className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200 cursor-pointer shadow-lg active:scale-95 ${
            isDark
              ? 'bg-white hover:bg-neutral-200 text-black shadow-white/5'
              : 'bg-neutral-900 hover:bg-neutral-800 text-white shadow-neutral-900/10'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 stroke-[1.75]" />
          <span>Analyze another resume</span>
        </button>
      </div>

      {/* Score Card Preview & iOS Fallback Modal */}
      {previewModalDataUrl && (
        <div
          id="scorecard-preview-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scorecard-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewModalDataUrl(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn"
          style={{
            WebkitBackdropFilter: 'blur(8px)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            className={`w-full max-w-lg rounded-3xl border shadow-2xl relative flex flex-col max-h-[88vh] overflow-hidden ${
              isDark ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-200 text-neutral-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Fixed, never scrolls) */}
            <div
              className={`p-5 sm:p-6 pb-3.5 shrink-0 relative border-b ${
                isDark ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => setPreviewModalDataUrl(null)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-neutral-800/20 cursor-pointer flex items-center gap-1.5 text-neutral-400 hover:text-neutral-200"
                aria-label="Close modal (Esc)"
                title="Close modal (Esc)"
              >
                <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border border-neutral-700/60 bg-neutral-800/60 text-neutral-400">
                  ESC
                </kbd>
                <X className="w-5 h-5" />
              </button>

              <h3 id="scorecard-modal-title" className="text-lg font-bold mb-1 pr-14">ATS Compatibility Score Card Preview</h3>
              <p className="text-xs text-neutral-400">
                Rendered at 1080×1350 with frosted glass aesthetic matching the website.
              </p>
            </div>

            {/* Scrollable Content Body (Isolated scroll container) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 overscroll-contain bg-neutral-950/20 flex flex-col items-center">
              <div className="w-full flex items-center justify-center rounded-2xl border border-neutral-700/40 bg-black/40 p-2 shadow-inner">
                <img
                  src={previewModalDataUrl}
                  alt="ATS Score Card Preview"
                  className="max-w-full h-auto max-h-[56vh] object-contain rounded-xl shadow-lg"
                />
              </div>
            </div>

            {/* Modal Footer (Fixed, solid background, never overlaps) */}
            <div
              className={`p-4 sm:px-6 shrink-0 border-t ${
                isDark ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-neutral-50'
              } flex items-center justify-between gap-2.5 z-10`}
            >
              <a
                href={previewModalDataUrl}
                download={`resume-ats-scorecard-${Date.now()}.png`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download PNG</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  window.open(previewModalDataUrl, '_blank');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                  isDark
                    ? 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-600'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300'
                }`}
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in Tab</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewModalDataUrl(null)}
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold border cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                  isDark
                    ? 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 border-neutral-700'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-300'
                }`}
                title="Close (Esc)"
              >
                <span>Close</span>
                <kbd className="text-[10px] font-mono opacity-60">Esc</kbd>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
