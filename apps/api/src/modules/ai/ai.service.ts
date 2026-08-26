import type { OpportunityType } from '@aip/config';
import { getModel, isGeminiConfigured } from '../../config/gemini';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { computeSkillGap, type GapSkill, type SkillGapAnalysis } from '../matching/skillGap';

/** A slow provider must not hold an Express request open indefinitely. */
const GEMINI_TIMEOUT_MS = 20_000;

function assertConfigured(): void {
  if (!isGeminiConfigured()) {
    throw AppError.serviceUnavailable('AI is not configured');
  }
}

async function callGemini(prompt: string): Promise<string> {
  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const model = getModel();
      const result = await withTimeout(model.generateContent(prompt), GEMINI_TIMEOUT_MS);
      return result.response.text();
    } catch (err) {
      lastErr = err;
      const msg = String((err as { message?: string })?.message ?? '');
      const isRetryable = /\b(429|503|overload|high demand|unavailable|timed out)\b/i.test(msg);
      if (!isRetryable || attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  logger.warn({ err: (lastErr as Error | undefined)?.message }, 'Gemini request failed');
  // The provider's own message can name the model, quota or key, so it is logged
  // server-side and deliberately not carried into the client response.
  throw AppError.internal('AI request failed');
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Gemini request timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function extractJsonArray(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

export interface AnalyzeResumeResult {
  skills: string[];
  warning?: string;
}

export async function analyzeResumeText(text: string): Promise<AnalyzeResumeResult> {
  assertConfigured();
  const prompt = [
    'Extract the technical and soft skills mentioned in this resume text.',
    'Respond ONLY as a valid JSON array of strings, no prose, no markdown fences.',
    'Text:',
    text,
  ].join('\n');

  const raw = await callGemini(prompt);
  const parsed = extractJsonArray(raw);
  if (!Array.isArray(parsed)) {
    return { skills: [], warning: 'Could not parse AI response' };
  }
  const skills = parsed
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((s) => s.trim());
  return { skills };
}

export interface ExplainJobMatchInput {
  studentSkillIds?: string[];
  opportunityId: string;
  opportunityType: OpportunityType;
}

export interface ExplainJobMatchResult extends SkillGapAnalysis {
  /** Skill names only — kept so existing clients render without changes. */
  matched: string[];
  missing: string[];
  narrative: string;
  /**
   * True only when `narrative` came back from Gemini. The UI uses this to label
   * the text honestly instead of presenting the deterministic summary as AI
   * output.
   */
  aiEnhanced: boolean;
  /** Why the AI narrative is absent, when it is. Never contains provider detail. */
  aiUnavailableReason?: 'NOT_CONFIGURED' | 'REQUEST_FAILED';
}

function names(skills: GapSkill[]): string[] {
  return skills.map((s) => s.name);
}

/**
 * The summary shown when Gemini is unavailable. It is assembled from the
 * computed numbers only — it never invents a skill or a claim the arithmetic
 * doesn't support, and it is never labelled as AI output.
 */
function deterministicNarrative(gap: SkillGapAnalysis): string {
  const required = gap.requiredSkills.length;
  if (required === 0) {
    return `This ${gap.opportunityType.toLowerCase()} does not list any required skills, so there is no skill gap to close. Review the description to judge the fit.`;
  }
  const parts = [
    `You match ${gap.matchedSkills.length} of ${required} required skills (${gap.matchPercentage}%).`,
  ];
  if (gap.missingSkills.length > 0) {
    parts.push(`To close the gap, focus on: ${names(gap.missingSkills).join(', ')}.`);
  } else {
    parts.push('You meet every required skill for this opportunity.');
  }
  if (gap.preferredSkills.length > 0) {
    parts.push(
      `You also hold ${gap.preferredMatched.length} of ${gap.preferredSkills.length} preferred skills.`,
    );
  }
  parts.push(gap.recommendation);
  return parts.join(' ');
}

function buildPrompt(gap: SkillGapAnalysis): string {
  const matched = names(gap.matchedSkills);
  const missing = names(gap.missingSkills);
  return [
    `You are analyzing a match between a student and the ${gap.opportunityType.toLowerCase()} "${gap.opportunityTitle}".`,
    `Match score: ${gap.score}/100 (${gap.level}). Required skills met: ${gap.matchedSkills.length}/${gap.requiredSkills.length} (${gap.matchPercentage}%).`,
    `Matched skills: ${matched.length > 0 ? matched.join(', ') : 'none'}.`,
    `Missing skills: ${missing.length > 0 ? missing.join(', ') : 'none'}.`,
    'Write 2-3 sentences summarizing the fit and give exactly one specific, actionable recommendation for the student.',
    'Only discuss the skills listed above — do not introduce any other skill, employer or statistic.',
    'Do not restate the score. Do not include lists or headings; return plain prose.',
  ].join('\n');
}

/**
 * Produces a skill-gap analysis for one opportunity.
 *
 * The numbers are always computed from MongoDB by `computeSkillGap`; Gemini is
 * only ever asked for the prose. If it is unconfigured or fails, the request
 * still succeeds with the deterministic analysis and a locally-written summary,
 * flagged via `aiEnhanced: false` so nothing fabricated is passed off as AI.
 */
export async function explainJobMatch(
  userId: string,
  input: ExplainJobMatchInput,
): Promise<ExplainJobMatchResult> {
  const gap = await computeSkillGap(
    userId,
    input.opportunityType,
    input.opportunityId,
    input.studentSkillIds,
  );

  const base = {
    ...gap,
    matched: names(gap.matchedSkills),
    missing: names(gap.missingSkills),
  };

  if (!isGeminiConfigured()) {
    logger.info(
      { opportunityId: gap.opportunityId, opportunityType: gap.opportunityType },
      'Skill gap served from deterministic analysis: Gemini is not configured',
    );
    return {
      ...base,
      narrative: deterministicNarrative(gap),
      aiEnhanced: false,
      aiUnavailableReason: 'NOT_CONFIGURED',
    };
  }

  try {
    const narrative = (await callGemini(buildPrompt(gap))).trim();
    if (narrative.length === 0) throw new Error('Gemini returned an empty narrative');
    return { ...base, narrative, aiEnhanced: true };
  } catch (err) {
    // `callGemini` has already logged the provider's message; this records that
    // the feature degraded rather than failed. The error itself is swallowed on
    // purpose — the analysis below is complete and correct without it.
    logger.warn(
      {
        opportunityId: gap.opportunityId,
        opportunityType: gap.opportunityType,
        reason: (err as Error).message,
      },
      'Skill gap fell back to deterministic analysis: Gemini request failed',
    );
    return {
      ...base,
      narrative: deterministicNarrative(gap),
      aiEnhanced: false,
      aiUnavailableReason: 'REQUEST_FAILED',
    };
  }
}

export async function chatOnce(message: string): Promise<{ reply: string }> {
  assertConfigured();
  const prompt = [
    'System: You are a career assistant for the Academia-Industry Portal.',
    "Only answer based on the user's message. Never invent job listings, companies, or statistics.",
    "If asked something factual you don't know, say so plainly.",
    'Respond in plain prose, at most 200 words.',
    '',
    `User: ${message}`,
  ].join('\n');

  const reply = (await callGemini(prompt)).trim();
  return { reply };
}
