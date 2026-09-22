import React, { useEffect, useState } from 'react';
import { ThemeMode } from '../types';

interface CircularGaugeProps {
  score: number;
  theme: ThemeMode;
}

export const CircularGauge: React.FC<CircularGaugeProps> = ({ score, theme }) => {
  const isDark = theme === 'dark';
  const [animatedScore, setAnimatedScore] = useState(0);

  // Color-coded: red under 50, yellow 50-75, green above 75
  const getScoreColor = (val: number) => {
    if (val < 50) return '#ef4444'; // Red
    if (val <= 75) return '#eab308'; // Yellow
    return '#22c55e'; // Green
  };

  const getScoreCategory = (val: number) => {
    if (val < 50) return { label: 'Low Match', sub: 'Significant ATS skill gaps detected' };
    if (val <= 75) return { label: 'Moderate Match', sub: 'Foundational match with key missing skills' };
    return { label: 'Strong Match', sub: 'High recruiter keyword & qualification alignment' };
  };

  const activeColor = getScoreColor(score);
  const category = getScoreCategory(score);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  // SVG Gauge geometry
  const size = 200;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
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
            stroke={activeColor}
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
              style={{ color: activeColor }}
            >
              {animatedScore}
            </span>
            <span
              className={`text-xl font-medium ml-1 ${
                isDark ? 'text-neutral-500' : 'text-neutral-500'
              }`}
            >
              /100
            </span>
          </div>
          <span
            className={`text-xs uppercase tracking-wider font-semibold mt-1 ${
              isDark ? 'text-neutral-400' : 'text-neutral-600'
            }`}
          >
            ATS Match Score
          </span>
        </div>
      </div>

      {/* Category Verdict Badge */}
      <div className="mt-4 text-center">
        <div
          id="score-verdict-badge"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
          style={{
            backgroundColor: `${activeColor}15`,
            color: activeColor,
            border: `1px solid ${activeColor}40`,
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: activeColor }}
          />
          {category.label}
        </div>
        <p
          className={`text-xs mt-1.5 ${
            isDark ? 'text-neutral-400' : 'text-neutral-600'
          }`}
        >
          {category.sub}
        </p>
      </div>
    </div>
  );
};
