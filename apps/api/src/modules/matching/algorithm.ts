import { MATCHING_WEIGHTS, MATCH_THRESHOLDS, type MatchLevel } from '@aip/config';
import type { MatchResult } from '@aip/types';

export interface MatchCounts {
  requiredTotal: number;
  requiredMatched: number;
  preferredTotal: number;
  preferredMatched: number;
}

export interface MatchScore {
  score: number;
  level: MatchLevel;
  recommendation: string;
}

/**
 * Turns match counts into the 0-100 score, its level and the one-line summary.
 *
 * Kept separate from `computeMatch` so the skill-gap analysis can score its own
 * name-aware comparison without duplicating the weighting rules — two copies of
 * this arithmetic would inevitably drift apart.
 */
export function scoreMatch(counts: MatchCounts): MatchScore {
  // An opportunity that lists no required skills sets no bar to clear, so treat
  // it as fully met. The previous `matched / Math.max(1, total)` guard scored
  // that case 0 and told the student they had "significant skill gaps" against
  // a posting that asked for nothing.
  const reqRatio = counts.requiredTotal === 0 ? 1 : counts.requiredMatched / counts.requiredTotal;
  const prefRatio =
    counts.preferredTotal === 0 ? 0 : counts.preferredMatched / counts.preferredTotal;

  // With no preferred skills listed there is nothing for that slice of the score
  // to measure, so the required skills carry all 100 points. Splitting 80/20
  // regardless left a candidate who met every requirement on 80/100, which put
  // STRONG_MATCH (>= 85) out of reach for every posting without preferred skills.
  const requiredWeight = counts.preferredTotal === 0 ? 100 : MATCHING_WEIGHTS.REQUIRED;
  const preferredWeight = counts.preferredTotal === 0 ? 0 : MATCHING_WEIGHTS.PREFERRED;
  const score = Math.round(reqRatio * requiredWeight + prefRatio * preferredWeight);

  let level: MatchLevel;
  if (score >= MATCH_THRESHOLDS.STRONG) level = 'STRONG_MATCH';
  else if (score >= MATCH_THRESHOLDS.GOOD) level = 'GOOD_MATCH';
  else if (score >= MATCH_THRESHOLDS.PARTIAL) level = 'PARTIAL_MATCH';
  else level = 'LOW_MATCH';

  const recommendation =
    level === 'STRONG_MATCH'
      ? 'Excellent fit — you meet nearly all requirements.'
      : level === 'GOOD_MATCH'
        ? 'Good fit — you meet most core requirements.'
        : level === 'PARTIAL_MATCH'
          ? 'Partial fit — consider building the missing skills.'
          : 'Low fit — significant skill gaps to address.';

  return { score, level, recommendation };
}

export function computeMatch(
  studentSkillIds: string[],
  requiredSkillIds: string[],
  preferredSkillIds: string[],
): MatchResult {
  const studentSet = new Set(studentSkillIds.map(String));
  const requiredSet = new Set(requiredSkillIds.map(String));
  const preferredSet = new Set(preferredSkillIds.map(String));

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  const preferredMatched: string[] = [];
  const extraSkills: string[] = [];

  for (const id of requiredSet) {
    if (studentSet.has(id)) matchedSkills.push(id);
    else missingSkills.push(id);
  }
  for (const id of preferredSet) {
    if (studentSet.has(id)) preferredMatched.push(id);
  }
  for (const id of studentSet) {
    if (!requiredSet.has(id) && !preferredSet.has(id)) extraSkills.push(id);
  }

  const { score, level, recommendation } = scoreMatch({
    requiredTotal: requiredSet.size,
    requiredMatched: matchedSkills.length,
    preferredTotal: preferredSet.size,
    preferredMatched: preferredMatched.length,
  });

  return {
    score,
    matchedSkills,
    missingSkills,
    extraSkills,
    preferredMatched,
    level,
    recommendation,
  };
}
