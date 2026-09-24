export interface CategoryBreakdown {
  skills: number;
  experience: number;
  education: number;
  formatting: number;
}

export interface AnalysisResult {
  overall_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: string[];
  breakdown?: CategoryBreakdown;
}

export type ThemeMode = 'dark' | 'light';

export interface UploadedPdfInfo {
  name: string;
  size: number;
  pageCount: number;
  text: string;
}
