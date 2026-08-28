import type { AiSkillGapAnalysis } from '@aip/types';
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

/**
 * Extracts the first JSON object found in the text. Tries:
 * 1. A ```json ... ``` code block
 * 2. Any {...} sequence
 * 3. Direct JSON.parse of the trimmed text
 * Returns null if nothing parseable is found.
 */
function extractJsonObject(text: string): AiSkillGapAnalysis | null {
  const trimmed = text.trim();

  // Try a ```json ... ``` block first
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]!.trim());
    } catch {
      // fall through
    }
  }

  // Try to find the outermost {...}
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      // fall through
    }
  }

  // Try the whole text
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Validates and normalises a parsed object into AiSkillGapAnalysis.
 *
 * Each of the four expected fields is required: arrays must be arrays
 * (otherwise the structure is wrong), and `matchExplanation` must be a string.
 * Returns null on structural failure so the caller can fall back to math.
 */
function parseAiAnalysis(raw: unknown): AiSkillGapAnalysis | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const arrOfStr = (v: unknown): string[] | null => {
    if (v === null || v === undefined) return [];
    if (!Array.isArray(v)) return null;
    return v
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((s) => s.trim());
  };
  const skillGaps = arrOfStr(obj.skillGaps);
  const strengths = arrOfStr(obj.strengths);
  const recommendedSkills = arrOfStr(obj.recommendedSkills);
  if (skillGaps === null || strengths === null || recommendedSkills === null) return null;
  if (typeof obj.matchExplanation !== 'string') return null;

  return {
    skillGaps,
    strengths,
    recommendedSkills,
    matchExplanation: obj.matchExplanation.trim(),
  };
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
  /** Structured AI analysis — always present, populated from math when Gemini is unavailable. */
  aiAnalysis: AiSkillGapAnalysis;
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

/**
 * Assembles the deterministic (math-only) aiAnalysis for when Gemini is unavailable.
 */
function deterministicAiAnalysis(gap: SkillGapAnalysis): AiSkillGapAnalysis {
  return {
    skillGaps: names(gap.missingSkills),
    strengths: names(gap.matchedSkills),
    recommendedSkills: names(gap.missingSkills),
    matchExplanation: deterministicNarrative(gap),
  };
}

function buildPrompt(gap: SkillGapAnalysis): string {
  const matched = names(gap.matchedSkills);
  const missing = names(gap.missingSkills);
  const preferred = names(gap.preferredSkills);
  const preferredHeld = names(gap.preferredMatched);

  return [
    `You are analyzing a student-opportunity match for "${gap.opportunityTitle}" (${gap.opportunityType.toLowerCase()}).`,
    `Score: ${gap.score}/100 (${gap.level}). Required skills met: ${gap.matchedSkills.length}/${gap.requiredSkills.length} (${gap.matchPercentage}%). Preferred skills held: ${gap.preferredMatched.length}/${gap.preferredSkills.length}.`,
    `Required skills: ${matched.length > 0 ? matched.join(', ') : 'none'}.`,
    `Missing skills: ${missing.length > 0 ? missing.join(', ') : 'none'}.`,
    `Preferred skills: ${preferred.length > 0 ? preferred.join(', ') : 'none'}.`,
    `Preferred skills you have: ${preferredHeld.length > 0 ? preferredHeld.join(', ') : 'none'}.`,
    '',
    'Return ONLY a single JSON object in a ```json ... ``` code block, with exactly these four fields:',
    '{',
    '  "skillGaps": ["skill1", "skill2", ...],   // skills you are missing that are critical for the role',
    '  "strengths": ["skill1", "skill2", ...],   // your key strengths relative to this opportunity',
    '  "recommendedSkills": ["skill1", "skill2", ...],  // specific, actionable skills to learn or improve',
    '  "matchExplanation": "2-4 sentence prose explanation of the match and what to focus on"',
    '}',
    'Only mention skills from the lists above — do not introduce any other skill, employer, or statistic.',
  ].join('\n');
}

/**
 * Produces a skill-gap analysis for one opportunity.
 *
 * The numbers are always computed from MongoDB by `computeSkillGap`; Gemini is
 * only ever asked for the enriched structured analysis. If it is unconfigured,
 * times out, or returns malformed data, the request still succeeds with the
 * deterministic analysis, flagged via `aiEnhanced: false` so nothing fabricated
 * is passed off as AI.
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
      aiAnalysis: deterministicAiAnalysis(gap),
    };
  }

  try {
    const raw = (await callGemini(buildPrompt(gap))).trim();
    if (raw.length === 0) throw new Error('Gemini returned an empty response');

    const parsed = extractJsonObject(raw);
    if (parsed === null) {
      logger.warn(
        { opportunityId: gap.opportunityId },
        'Skill gap: Gemini response was not valid JSON — falling back',
      );
      throw new Error('Gemini response was not valid JSON');
    }

    const aiAnalysis = parseAiAnalysis(parsed);
    if (aiAnalysis === null) {
      logger.warn(
        { opportunityId: gap.opportunityId },
        'Skill gap: Gemini JSON had invalid structure — falling back',
      );
      throw new Error('Gemini JSON had invalid structure');
    }

    const narrative = aiAnalysis.matchExplanation || deterministicNarrative(gap);
    return {
      ...base,
      narrative,
      aiEnhanced: true,
      aiAnalysis,
    };
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
      aiAnalysis: deterministicAiAnalysis(gap),
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
