import React from 'react';
import { ThemeMode } from '../types';

interface BackgroundGradientsProps {
  theme: ThemeMode;
}

export const BackgroundGradients: React.FC<BackgroundGradientsProps> = ({ theme }) => {
  const isDark = theme === 'dark';

  return (
    <div
      id="ambient-background-layer"
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* 
        Single Unified Tone Architecture:
        Zero rainbow / multi-color patches.
        A clean, professional, monochromatic single-color ambient glow that seamlessly matches the background:
        - In dark mode: subtle neutral silver/slate glow against pure black (#000000).
        - In light mode: soft subtle neutral gray/slate glow against soft light gray (#f3f4f6).
      */}

      {/* Top ambient soft neutral glow (unified single color matching the background) */}
      <div
        className={`absolute -top-16 left-1/2 -translate-x-1/2 w-[420px] sm:w-[600px] h-[240px] rounded-full blur-[80px] sm:blur-[100px] transition-all duration-700 ${
          isDark
            ? 'opacity-25 bg-gradient-to-b from-white/10 via-neutral-400/5 to-transparent'
            : 'opacity-40 bg-gradient-to-b from-neutral-300/40 via-neutral-200/20 to-transparent'
        }`}
      />

      {/* Subtle side accent patch (left) - single matching neutral color */}
      <div
        className={`absolute top-[420px] -left-12 w-48 h-48 rounded-full blur-[60px] transition-all duration-700 ${
          isDark
            ? 'opacity-20 bg-gradient-to-r from-neutral-300/10 to-transparent'
            : 'opacity-30 bg-gradient-to-r from-neutral-400/15 to-transparent'
        }`}
      />

      {/* Subtle side accent patch (right) - single matching neutral color */}
      <div
        className={`absolute top-[680px] -right-12 w-52 h-52 rounded-full blur-[65px] transition-all duration-700 ${
          isDark
            ? 'opacity-20 bg-gradient-to-l from-neutral-300/10 to-transparent'
            : 'opacity-30 bg-gradient-to-l from-neutral-400/15 to-transparent'
        }`}
      />

      {/* Minimalist Monochromatic Graphic Accents (Single color matching background, no rainbow) */}
      <div
        className={`absolute inset-0 max-w-6xl mx-auto px-6 hidden lg:block transition-opacity duration-300 ${
          isDark ? 'opacity-25 text-neutral-600' : 'opacity-30 text-neutral-400'
        }`}
      >
        {/* Top-left minimal geometric crosshair */}
        <svg
          className="absolute top-16 left-6 w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <path d="M12 2V22M2 12H22" strokeLinecap="round" />
          <circle cx="12" cy="12" r="4" strokeDasharray="2 2" />
        </svg>

        {/* Top-right minimal subtle corner accent */}
        <svg
          className="absolute top-24 right-8 w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <rect x="3" y="3" width="18" height="18" rx="4" strokeDasharray="3 2" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>

        {/* Mid-left minimal dot cluster */}
        <svg
          className="absolute top-[480px] -left-2 w-5 h-16"
          viewBox="0 0 20 64"
          fill="currentColor"
        >
          {[0, 16, 32, 48].map((y, i) => (
            <circle key={i} cx="10" cy={y + 6} r="1.5" />
          ))}
        </svg>

        {/* Mid-right minimal geometric diamond */}
        <svg
          className="absolute top-[580px] -right-2 w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <path d="M12 2L22 12L12 22L2 12Z" strokeDasharray="3 2" />
        </svg>
      </div>
    </div>
  );
};
