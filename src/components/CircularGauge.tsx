import React, { useEffect, useState } from 'react';
import { ThemeMode } from '../types';
import { ATS_LABELS, GAUGE_CONFIG, getScoreTier } from '../constants/atsConstants';

interface CircularGaugeProps {
  score: number;
  theme: ThemeMode;
}

export const CircularGauge: React.FC<CircularGaugeProps> = ({ score, theme }) => {
  const isDark = theme === 'dark';
  const [animatedScore, setAnimatedScore] = useState(0);

  const tier = getScoreTier(score);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  // SVG Gauge geometry from shared GAUGE_CONFIG
  const size = GAUGE_CONFIG.size;
  const strokeWidth = GAUGE_CONFIG.strokeWidth;
  const radius = GAUGE_CONFIG.radius;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div id="circular-gauge-container" className="flex flex-col items-center justify-center py-2">
      <div className="relative flex items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={tier.color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease',
            }}
          />
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="flex items-baseline justify-center">
            <span
              id="overall-score-number"
              className="text-5xl sm:text-6xl font-extrabold tracking-tight font-mono transition-colors"
              style={{ color: tier.color }}
            >
              {animatedScore}
            </span>
            <span
              className={`text-xl font-medium ml-1 ${
                isDark ? 'text-neutral-500' : 'text-neutral-500'
              }`}
            >
              {ATS_LABELS.MAX_SCORE_LABEL}
            </span>
          </div>
          <span
            className={`text-xs uppercase tracking-wider font-semibold mt-1 ${
              isDark ? 'text-neutral-400' : 'text-neutral-600'
            }`}
          >
            {ATS_LABELS.SCORE_GAUGE_LABEL}
          </span>
        </div>
      </div>

      {/* Category Verdict Badge */}
      <div className="mt-4 text-center">
        <div
          id="score-verdict-badge"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
          style={{
            backgroundColor: isDark ? tier.badgeBgDark : tier.badgeBgLight,
            color: tier.color,
            border: `1px solid ${isDark ? tier.badgeBorderDark : tier.badgeBorderLight}`,
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: tier.color }}
          />
          {tier.label}
        </div>
        <p
          className={`text-xs mt-1.5 ${
            isDark ? 'text-neutral-400' : 'text-neutral-600'
          }`}
        >
          {tier.sub}
        </p>
      </div>
    </div>
  );
};
