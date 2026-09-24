// Single Source of Truth for ATS Compatibility Analysis
// Shared between Website UI (ResultsSection, CircularGauge) and Canvas Image Exporter (exportScoreCard)

export const ATS_LABELS = {
  // Hero Score Card
  MAIN_BADGE: 'ATS COMPATIBILITY ANALYSIS',
  SUBTITLE: 'Candidate Match Score',
  DESCRIPTION: 'Synthesized across critical skill sets, job domain requirements, and recruiter filtering criteria.',
  SCORE_GAUGE_LABEL: 'ATS MATCH SCORE',
  MAX_SCORE_LABEL: '/100',

  // Category Breakdown Panel
  BREAKDOWN_TITLE: 'Weighted Category Breakdown',
  BREAKDOWN_SUBTITLE: 'Deterministic score derived from 4 weighted pillars',

  // Sections
  MATCHED_SKILLS_TITLE: 'Matched Skills',
  MATCHED_SKILLS_SUBTITLE: 'Found in both your resume & job description',

  MISSING_KEYWORDS_TITLE: 'Missing Keywords',
  MISSING_KEYWORDS_SUBTITLE: 'Demanded in job description but missing in resume',

  SUGGESTIONS_TITLE: "Recruiter's Actionable Suggestions",
  SUGGESTIONS_SUBTITLE: 'High impact tweaks to increase matching efficiency',

  // Footer & Branding
  BRAND_NAME_PREFIX: 'show your',
  BRAND_NAME_MAIN: 'RESUME',
  BRAND_ALPHA: 'α',
  FOOTER_ENGINE_CREDIT: "Resume Analyzer powered by Suman's ATS Match Engine",
  FOOTER_AUTHOR_CREDIT: 'Made by Suman Prasad Sahoo',
} as const;

export const CATEGORY_DEFINITIONS = [
  {
    id: 'skills',
    title: 'Technical Skills Match',
    weight: '45% Weight',
    weightPercent: 45,
    description: 'Core languages, frameworks, cloud platforms & tools',
  },
  {
    id: 'experience',
    title: 'Experience & Seniority Fit',
    weight: '25% Weight',
    weightPercent: 25,
    description: 'Career years, scope of ownership & quantified impact metrics',
  },
  {
    id: 'education',
    title: 'Education & Certifications',
    weight: '15% Weight',
    weightPercent: 15,
    description: 'Degree alignment, STEM foundation & domain credentials',
  },
  {
    id: 'formatting',
    title: 'ATS Formatting & Readability',
    weight: '15% Weight',
    weightPercent: 15,
    description: 'Standard section labeling, action verbs & parseability',
  },
] as const;

export interface ScoreTier {
  color: string;
  badgeBgDark: string;
  badgeBorderDark: string;
  badgeBgLight: string;
  badgeBorderLight: string;
  label: string;
  sub: string;
}

export function getScoreColor(val: number): string {
  if (val < 50) return '#ef4444'; // Red
  if (val <= 75) return '#eab308'; // Yellow
  return '#22c55e'; // Green
}

export function getScoreTier(val: number): ScoreTier {
  if (val < 50) {
    return {
      color: '#ef4444',
      badgeBgDark: 'rgba(239, 68, 68, 0.15)',
      badgeBorderDark: 'rgba(239, 68, 68, 0.4)',
      badgeBgLight: 'rgba(239, 68, 68, 0.12)',
      badgeBorderLight: 'rgba(239, 68, 68, 0.35)',
      label: 'LOW MATCH',
      sub: 'Significant ATS skill gaps detected',
    };
  }
  if (val <= 75) {
    return {
      color: '#eab308',
      badgeBgDark: 'rgba(234, 179, 8, 0.15)',
      badgeBorderDark: 'rgba(234, 179, 8, 0.4)',
      badgeBgLight: 'rgba(234, 179, 8, 0.12)',
      badgeBorderLight: 'rgba(234, 179, 8, 0.35)',
      label: 'MODERATE MATCH',
      sub: 'Foundational match with key missing skills',
    };
  }
  return {
    color: '#22c55e',
    badgeBgDark: 'rgba(34, 197, 94, 0.15)',
    badgeBorderDark: 'rgba(34, 197, 94, 0.4)',
    badgeBgLight: 'rgba(34, 197, 94, 0.12)',
    badgeBorderLight: 'rgba(34, 197, 94, 0.35)',
    label: 'STRONG MATCH',
    sub: 'High recruiter keyword & qualification alignment',
  };
}

export const GAUGE_CONFIG = {
  strokeWidth: 14,
  radius: 86,
  size: 200,
} as const;
