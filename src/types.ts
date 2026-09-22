export interface AnalysisResult {
  overall_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: string[];
}

export type ThemeMode = 'dark' | 'light';

export interface UploadedPdfInfo {
  name: string;
  size: number;
  pageCount: number;
  text: string;
}
