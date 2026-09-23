import { AnalysisResult, ThemeMode } from '../types';
import { ATS_LABELS, CATEGORY_DEFINITIONS, getScoreTier } from '../constants/atsConstants';

interface ExportOptions {
  results: AnalysisResult;
  theme: ThemeMode;
}

export interface ExportResult {
  dataUrl: string;
  isIos: boolean;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle?: string | CanvasGradient,
  strokeStyle?: string,
  lineWidth: number = 1
) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 3
): number {
  const words = text.split(' ');
  let line = '';
  let linesCount = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, y);
      line = words[n] + ' ';
      y += lineHeight;
      linesCount++;
      if (linesCount >= maxLines - 1 && n < words.length - 1) {
        let remaining = words.slice(n).join(' ');
        while (ctx.measureText(remaining + '...').width > maxWidth && remaining.length > 0) {
          remaining = remaining.slice(0, -3);
        }
        ctx.fillText(remaining + '...', x, y);
        linesCount++;
        return y;
      }
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, y);
  return y;
}

export async function generateScoreCardCanvas({ results, theme }: ExportOptions): Promise<ExportResult> {
  const isDark = theme === 'dark';
  const width = 1080;
  const height = 1350;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context is not available.');
  }

  // Ensure high quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const score = results.overall_score;
  const tier = getScoreTier(score);

  // 1. Background Gradient & Ambient Glows
  if (isDark) {
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#09090b');
    bgGradient.addColorStop(0.5, '#0c0d10');
    bgGradient.addColorStop(1, '#020202');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Ambient radial glow top right (color-coded to score tier)
    const glow1 = ctx.createRadialGradient(900, 150, 20, 900, 150, 450);
    glow1.addColorStop(0, `${tier.color}1f`);
    glow1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, width, height);

    // Ambient radial glow bottom left
    const glow2 = ctx.createRadialGradient(200, 1200, 20, 200, 1200, 500);
    glow2.addColorStop(0, 'rgba(99, 102, 241, 0.08)');
    glow2.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, width, height);
  } else {
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#f8fafc');
    bgGradient.addColorStop(0.5, '#f1f5f9');
    bgGradient.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const glow1 = ctx.createRadialGradient(900, 150, 20, 900, 150, 450);
    glow1.addColorStop(0, `${tier.color}14`);
    glow1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, width, height);
  }

  // Common color palette
  const textPrimary = isDark ? '#ffffff' : '#0f172a';
  const textSecondary = isDark ? '#a1a1aa' : '#475569';
  const textMuted = isDark ? '#71717a' : '#64748b';
  const glassCardBg = isDark ? 'rgba(24, 24, 27, 0.65)' : 'rgba(255, 255, 255, 0.78)';
  const glassCardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)';

  // 2. Top Header Bar (x: 50, y: 35, w: 980, h: 56)
  drawRoundedRect(ctx, 50, 35, 980, 56, 18, glassCardBg, glassCardBorder, 1);

  // Left Tag Pill: ATS COMPATIBILITY ANALYSIS
  drawRoundedRect(
    ctx,
    68,
    45,
    275,
    36,
    18,
    isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
    glassCardBorder,
    1
  );
  // Glowing tier dot
  ctx.fillStyle = tier.color;
  ctx.beginPath();
  ctx.arc(88, 63, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = textPrimary;
  ctx.font = 'bold 12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(ATS_LABELS.MAIN_BADGE, 103, 67);

  // Header Right Timestamp
  ctx.fillStyle = textMuted;
  ctx.font = '500 13px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'right';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  ctx.fillText(`Evaluation Date: ${dateStr}`, 1005, 68);
  ctx.textAlign = 'left';

  // 3. Hero Score Card (The EXACT same design as the website results page!)
  // x: 50, y: 110, w: 980, h: 355
  drawRoundedRect(ctx, 50, 110, 980, 355, 26, glassCardBg, glassCardBorder, 1);

  // Centered Header Badge Pill inside Hero Card
  const heroBadgeW = 265;
  const heroBadgeH = 30;
  const heroBadgeX = 540 - heroBadgeW / 2;
  const heroBadgeY = 128;
  drawRoundedRect(
    ctx,
    heroBadgeX,
    heroBadgeY,
    heroBadgeW,
    heroBadgeH,
    15,
    isDark ? 'rgba(38, 38, 38, 0.6)' : 'rgba(240, 240, 240, 0.8)',
    isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    1
  );
  ctx.textAlign = 'center';
  ctx.fillStyle = isDark ? '#d4d4d8' : '#3f3f46';
  ctx.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(ATS_LABELS.MAIN_BADGE, 540, 147);

  // Hero Card Subtitle: "Candidate Match Score"
  ctx.fillStyle = textPrimary;
  ctx.font = 'bold 23px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(ATS_LABELS.SUBTITLE, 540, 184);

  // Hero Card Description: "Synthesized across critical skill sets, job domain requirements, and recruiter filtering criteria."
  ctx.fillStyle = textMuted;
  ctx.font = '500 13px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(ATS_LABELS.DESCRIPTION, 540, 206);

  // ==========================================
  // EXACT SCORE METER DESIGN (from website results page)
  // ==========================================
  const gaugeCenterX = 540;
  const gaugeCenterY = 282;
  const gaugeRadius = 80;
  const gaugeLineWidth = 12;

  // Background Track Circle
  ctx.beginPath();
  ctx.arc(gaugeCenterX, gaugeCenterY, gaugeRadius, 0, 2 * Math.PI);
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = gaugeLineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Progress Circle Arc (Starts at top: -PI/2, goes clockwise)
  const progressRatio = Math.max(0, Math.min(1, score / 100));
  if (progressRatio > 0) {
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + 2 * Math.PI * progressRatio;
    ctx.beginPath();
    ctx.arc(gaugeCenterX, gaugeCenterY, gaugeRadius, startAngle, endAngle);
    ctx.strokeStyle = tier.color;
    ctx.lineWidth = gaugeLineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Large centered score number with smaller "/100" beside it
  const scoreNumStr = `${score}`;
  const maxScoreStr = ATS_LABELS.MAX_SCORE_LABEL; // "/100"

  ctx.font = '800 46px monospace, "Plus Jakarta Sans", system-ui, sans-serif';
  const scoreWidth = ctx.measureText(scoreNumStr).width;
  ctx.font = '600 17px "Plus Jakarta Sans", system-ui, sans-serif';
  const maxScoreWidth = ctx.measureText(maxScoreStr).width;
  const totalScoreBlockW = scoreWidth + 4 + maxScoreWidth;
  const scoreStartX = gaugeCenterX - totalScoreBlockW / 2;

  // Draw Score Number
  ctx.textAlign = 'left';
  ctx.fillStyle = tier.color;
  ctx.font = '800 46px monospace, "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(scoreNumStr, scoreStartX, gaugeCenterY + 4);

  // Draw "/100"
  ctx.fillStyle = textMuted;
  ctx.font = '600 17px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(maxScoreStr, scoreStartX + scoreWidth + 4, gaugeCenterY + 2);

  // Stacked label 1 (inside gauge): "ATS MATCH SCORE" with ample breathing room from meter arc
  ctx.textAlign = 'center';
  ctx.fillStyle = textSecondary;
  ctx.font = 'bold 10.5px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(ATS_LABELS.SCORE_GAUGE_LABEL, gaugeCenterX, gaugeCenterY + 24);

  // Stacked label 2 (below gauge, own row with clear breathing room): Green "STRONG MATCH" pill
  // Gauge outer radius is 86 (bottom at 282 + 86 = 368).
  // The badge pill starts at y = 384 (16px breathing room below gauge)
  const verdictPillW = 170;
  const verdictPillH = 30;
  const verdictPillX = gaugeCenterX - verdictPillW / 2;
  const verdictPillY = 384;

  drawRoundedRect(
    ctx,
    verdictPillX,
    verdictPillY,
    verdictPillW,
    verdictPillH,
    15,
    isDark ? tier.badgeBgDark : tier.badgeBgLight,
    isDark ? tier.badgeBorderDark : tier.badgeBorderLight,
    1
  );

  // Glowing indicator dot
  ctx.fillStyle = tier.color;
  ctx.beginPath();
  ctx.arc(verdictPillX + 22, verdictPillY + 15, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Verdict pill label text
  ctx.fillStyle = tier.color;
  ctx.font = 'bold 12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(tier.label, gaugeCenterX + 7, verdictPillY + 19);

  // Stacked label 3 (below pill with clear breathing room):
  // Caption line: "High recruiter keyword & qualification alignment"
  ctx.fillStyle = textMuted;
  ctx.font = '500 12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(tier.sub, gaugeCenterX, 432);

  // 4. Weighted Category Breakdown Panel (x: 50, y: 485, w: 980, h: 165)
  drawRoundedRect(ctx, 50, 485, 980, 165, 24, glassCardBg, glassCardBorder, 1);

  // Title & Subtitle
  ctx.textAlign = 'left';
  ctx.fillStyle = textPrimary;
  ctx.font = 'bold 17px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(ATS_LABELS.BREAKDOWN_TITLE, 75, 513);

  ctx.fillStyle = textMuted;
  ctx.font = '500 11px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(ATS_LABELS.BREAKDOWN_SUBTITLE, 75, 530);

  // Breakdown overall pill tag on top right
  ctx.textAlign = 'right';
  ctx.fillStyle = isDark ? '#d4d4d8' : '#3f3f46';
  ctx.font = '600 12px monospace, "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`Overall: ${score}/100`, 1005, 515);
  ctx.textAlign = 'left';

  // 4 Category Bars (2x2 Grid)
  const breakdown = results.breakdown || {
    skills: Math.round(score * 0.9),
    experience: Math.round(score * 0.95),
    education: 90,
    formatting: 95,
  };

  const catGrid = [
    { ...CATEGORY_DEFINITIONS[0], scoreVal: breakdown.skills, col: 0, row: 0 },
    { ...CATEGORY_DEFINITIONS[1], scoreVal: breakdown.experience, col: 1, row: 0 },
    { ...CATEGORY_DEFINITIONS[2], scoreVal: breakdown.education, col: 0, row: 1 },
    { ...CATEGORY_DEFINITIONS[3], scoreVal: breakdown.formatting, col: 1, row: 1 },
  ];

  for (const item of catGrid) {
    const colX = item.col === 0 ? 75 : 555;
    const itemW = 445;
    const rowY = item.row === 0 ? 550 : 600;

    // Label & Weight
    ctx.fillStyle = textPrimary;
    ctx.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(item.title, colX, rowY);

    ctx.fillStyle = textMuted;
    ctx.font = '500 11px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`(${item.weight})`, colX + ctx.measureText(item.title).width + 6, rowY);

    // Percentage
    ctx.textAlign = 'right';
    const catColor = item.scoreVal >= 80 ? '#22c55e' : item.scoreVal >= 60 ? '#eab308' : '#ef4444';
    ctx.fillStyle = catColor;
    ctx.font = 'bold 13px monospace, "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`${item.scoreVal}%`, colX + itemW, rowY);
    ctx.textAlign = 'left';

    // Progress Bar Track
    const barY = rowY + 7;
    const barH = 7;
    drawRoundedRect(ctx, colX, barY, itemW, barH, 4, isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)');

    // Progress Bar Fill
    const fillW = Math.max(8, Math.min(itemW, (itemW * item.scoreVal) / 100));
    drawRoundedRect(ctx, colX, barY, fillW, barH, 4, catColor);
  }

  // 5. Two Columns: Matched Skills & Missing Keywords (y: 670, h: 220)
  const colW = 475;
  const colH = 220;

  // Left: Matched Skills (x: 50)
  drawRoundedRect(ctx, 50, 670, colW, colH, 24, glassCardBg, glassCardBorder, 1);
  drawRoundedRect(ctx, 70, 688, 32, 32, 10, isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.12)', 'rgba(34, 197, 94, 0.3)');
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 15px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('✓', 81, 709);

  ctx.fillStyle = textPrimary;
  ctx.font = 'bold 16px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(ATS_LABELS.MATCHED_SKILLS_TITLE, 112, 704);

  ctx.fillStyle = textMuted;
  ctx.font = '500 11px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(ATS_LABELS.MATCHED_SKILLS_SUBTITLE, 112, 719);

  // Matched Skills Count Pill
  ctx.textAlign = 'right';
  ctx.fillStyle = '#22c55e';
  ctx.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`${results.matched_keywords.length} found`, 505, 705);
  ctx.textAlign = 'left';

  // Render Matched Keyword Pills
  let pillX = 70;
  let pillY = 740;
  const maxPillRowX = 50 + colW - 20;

  for (const skill of results.matched_keywords.slice(0, 10)) {
    ctx.font = '500 12px "Plus Jakarta Sans", system-ui, sans-serif';
    const textMetrics = ctx.measureText(skill);
    const pillW = textMetrics.width + 28;

    if (pillX + pillW > maxPillRowX) {
      pillX = 70;
      pillY += 34;
      if (pillY > 860) break;
    }

    drawRoundedRect(ctx, pillX, pillY, pillW, 26, 9, isDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.08)', 'rgba(34, 197, 94, 0.3)', 1);

    // Green Dot
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(pillX + 10, pillY + 13, 3, 0, Math.PI * 2);
    ctx.fill();

    // Text
    ctx.fillStyle = isDark ? '#86efac' : '#14532d';
    ctx.fillText(skill, pillX + 19, pillY + 17);

    pillX += pillW + 8;
  }

  // Right: Missing Keywords (x: 555)
  drawRoundedRect(ctx, 555, 670, colW, colH, 24, glassCardBg, glassCardBorder, 1);
  drawRoundedRect(ctx, 575, 688, 32, 32, 10, isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.12)', 'rgba(239, 68, 68, 0.3)');
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 15px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('!', 589, 709);

  ctx.fillStyle = textPrimary;
  ctx.font = 'bold 16px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(ATS_LABELS.MISSING_KEYWORDS_TITLE, 617, 704);

  ctx.fillStyle = textMuted;
  ctx.font = '500 11px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(ATS_LABELS.MISSING_KEYWORDS_SUBTITLE, 617, 719);

  // Missing Keywords Count Pill
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ef4444';
  ctx.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`${results.missing_keywords.length} gaps`, 1010, 705);
  ctx.textAlign = 'left';

  // Render Missing Keyword Pills
  let missPillX = 575;
  let missPillY = 740;
  const maxMissRowX = 555 + colW - 20;

  if (results.missing_keywords.length === 0) {
    ctx.fillStyle = '#22c55e';
    ctx.font = '500 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Exceptional match! No high-priority missing skills.', 575, 775);
  } else {
    for (const skill of results.missing_keywords.slice(0, 10)) {
      ctx.font = '500 12px "Plus Jakarta Sans", system-ui, sans-serif';
      const textMetrics = ctx.measureText(skill);
      const pillW = textMetrics.width + 28;

      if (missPillX + pillW > maxMissRowX) {
        missPillX = 575;
        missPillY += 34;
        if (missPillY > 860) break;
      }

      drawRoundedRect(ctx, missPillX, missPillY, pillW, 26, 9, isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)', 'rgba(239, 68, 68, 0.3)', 1);

      // Red Dot
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(missPillX + 10, missPillY + 13, 3, 0, Math.PI * 2);
      ctx.fill();

      // Text
      ctx.fillStyle = isDark ? '#fca5a5' : '#991b1b';
      ctx.fillText(skill, missPillX + 19, pillY + 17);

      missPillX += pillW + 8;
    }
  }

  // 6. Recruiter's Actionable Suggestions Card (x: 50, y: 910, w: 980, h: 300)
  drawRoundedRect(ctx, 50, 910, 980, 300, 24, glassCardBg, glassCardBorder, 1);

  // Title with Icon
  drawRoundedRect(ctx, 75, 926, 32, 32, 10, isDark ? 'rgba(234, 179, 8, 0.15)' : 'rgba(234, 179, 8, 0.12)', 'rgba(234, 179, 8, 0.3)');
  ctx.fillStyle = '#eab308';
  ctx.font = 'bold 15px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('★', 85, 947);

  ctx.fillStyle = textPrimary;
  ctx.font = 'bold 17px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(ATS_LABELS.SUGGESTIONS_TITLE, 118, 942);

  ctx.fillStyle = textMuted;
  ctx.font = '500 11px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(ATS_LABELS.SUGGESTIONS_SUBTITLE, 118, 957);

  // Suggestions List
  let sugY = 975;
  const topSuggestions = results.suggestions.slice(0, 3);

  for (let i = 0; i < topSuggestions.length; i++) {
    const sug = topSuggestions[i];
    // Suggestion box
    drawRoundedRect(ctx, 75, sugY, 930, 68, 14, isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', glassCardBorder, 1);

    // Number circle
    drawRoundedRect(ctx, 92, sugY + 17, 32, 32, 9, isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)');
    ctx.fillStyle = textPrimary;
    ctx.font = 'bold 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${i + 1}`, 108, sugY + 38);
    ctx.textAlign = 'left';

    // Suggestion text
    ctx.fillStyle = textPrimary;
    ctx.font = '500 12px/1.4 "Plus Jakarta Sans", system-ui, sans-serif';
    wrapText(ctx, sug, 138, sugY + 28, 850, 18, 2);

    sugY += 76;
  }

  // 7. Footer Area (y: 1225 to 1330)
  // Subtle Divider line
  ctx.beginPath();
  ctx.moveTo(50, 1225);
  ctx.lineTo(1030, 1225);
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // BOTTOM LEFT: Brand Logo "show your RESUME α" with tight, consistent spacing matching site header
  const startX = 55;
  const logoBaselineY = 1262;
  const tightGap = 7; // uniform tight spacing between all elements

  // 1. "show your"
  ctx.textAlign = 'left';
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '600 15px "Plus Jakarta Sans", system-ui, sans-serif';
  const showYourText = 'show your';
  ctx.fillText(showYourText, startX, logoBaselineY);
  const showYourWidth = ctx.measureText(showYourText).width;

  // 2. "RESUME" with titanium silver gradient
  const resX = startX + showYourWidth + tightGap;
  const resText = 'RESUME';
  ctx.font = '900 21px "Plus Jakarta Sans", system-ui, sans-serif';
  const resWidth = ctx.measureText(resText).width;

  const resGradient = ctx.createLinearGradient(resX, logoBaselineY - 18, resX + resWidth, logoBaselineY);
  if (isDark) {
    resGradient.addColorStop(0, '#f4f4f5');
    resGradient.addColorStop(0.5, '#d4d4d8');
    resGradient.addColorStop(1, '#a1a1aa');
  } else {
    resGradient.addColorStop(0, '#18181b');
    resGradient.addColorStop(0.5, '#3f3f46');
    resGradient.addColorStop(1, '#27272a');
  }
  ctx.fillStyle = resGradient;
  ctx.fillText(resText, resX, logoBaselineY);

  // 3. Greek alpha "α" aligned with middle bar of E in RESUME
  const alphaX = resX + resWidth + tightGap;
  ctx.fillStyle = isDark ? '#d4d4d8' : '#3f3f46';
  ctx.font = '600 14px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('α', alphaX, logoBaselineY - 1);

  // Footer Left, row 2: "Resume Analyzer powered by Suman's ATS Match Engine"
  ctx.fillStyle = isDark ? '#71717a' : '#64748b';
  ctx.font = '500 12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(ATS_LABELS.FOOTER_ENGINE_CREDIT, startX, 1288);

  // Export as PNG Data URL
  const dataUrl = canvas.toDataURL('image/png');

  // Detect iOS
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

  return {
    dataUrl,
    isIos,
  };
}

export async function downloadScoreCardImage(options: ExportOptions): Promise<{ success: boolean; dataUrl: string; isIos: boolean }> {
  const { dataUrl, isIos } = await generateScoreCardCanvas(options);

  try {
    const filename = `resume-ats-scorecard-${Date.now()}.png`;

    // Convert data URL to Blob for robust download
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.setAttribute('target', '_self');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 2000);

    return { success: true, dataUrl, isIos };
  } catch (err) {
    console.error('Direct download error:', err);
    return { success: false, dataUrl, isIos };
  }
}
