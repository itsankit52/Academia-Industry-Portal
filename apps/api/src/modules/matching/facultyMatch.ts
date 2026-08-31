/**
 * Phase 13 — Faculty ↔ Industry opportunity matching
 *
 * Deterministic scoring between a faculty profile and a FacultyOpportunity.
 * The score is meant to be explainable: every contributing factor is named in
 * the breakdown that the API returns, so a faculty member can see *why* a
 * given score landed where it did. No ML, no LLM — just set intersections
 * against the required expertise and a structural check that the opportunity
 * targets faculty.
 *
 * Reuses the same `MATCH_THRESHOLDS` / `MATCH_LEVELS` declared in
 * `@aip/config` so faculty and student matches describe a fit in the same
 * language (STRONG_MATCH, GOOD_MATCH, etc.).
 */

import { MATCH_THRESHOLDS, type MatchLevel } from '@aip/config';
import type { MatchResult } from '@aip/types';

export interface FacultyMatchInput {
  /** Tags the candidate faculty member holds (qualifications, research interests, …). */
  facultyTags: string[];
  /** Tags the opportunity lists as required expertise. */
  requiredExpertise: string[];
  /** Whether the opportunity is open to faculty applicants at all. */
  targetsFaculty: boolean;
}

export interface FacultyMatchResult {
  /** 0-100 score. */
  score: number;
  /** 0-100 band ("STRONG_MATCH" | "GOOD_MATCH" | "PARTIAL_MATCH" | "LOW_MATCH"). */
  level: MatchLevel;
  /** Tags the opportunity asked for and the faculty member already has. */
  matchedExpertise: string[];
  /** Tags the opportunity asked for and the faculty member does not list. */
  missingExpertise: string[];
  /** Short, human-readable explanation of the score. */
  recommendation: string;
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * A weighted scoring blend, designed to mirror the experience a faculty
 * member would have if they sat down to read the posting:
 *
 *   - 70 points: overlap with `requiredExpertise`. This is the core "do you
 *     have what they asked for" question.
 *   - 20 points: a structural bonus awarded only when the opportunity is
 *     open to faculty. Without this, an opportunity that targets students
 *     only could still post a high expertise-overlap score against a
 *     faculty profile, which would mislead the candidate.
 *   - 10 points: breadth, measured as the ratio of required expertise the
 *     faculty member covers out of their *own* tag set. This rewards a
 *     faculty member whose profile is well-rounded on the topic, not just
 *     a 1-tag match on a 1-tag posting.
 */
export function computeFacultyMatch(input: FacultyMatchInput): MatchResult & FacultyMatchResult {
  const required = new Set(input.requiredExpertise.map(normalizeTag).filter(Boolean));
  const owned = new Set(input.facultyTags.map(normalizeTag).filter(Boolean));

  const matchedExpertise: string[] = [];
  const missingExpertise: string[] = [];
  for (const r of required) {
    if (owned.has(r)) matchedExpertise.push(r);
    else missingExpertise.push(r);
  }

  const requiredRatio = required.size === 0 ? 1 : matchedExpertise.length / required.size;
  const expertisePoints = Math.round(requiredRatio * 70);

  const eligibilityPoints = input.targetsFaculty ? 20 : 0;

  // Breadth = how much of the required set is covered by the candidate's
  // owned tags. We never let a near-empty required list push this to a
  // misleading 100; with no requirements listed, breadth is undefined and
  // we award the median (5) to avoid noisy banding.
  const breadthPoints =
    required.size === 0 ? 5 : Math.round((matchedExpertise.length / required.size) * 10);

  const score = Math.max(0, Math.min(100, expertisePoints + eligibilityPoints + breadthPoints));

  let level: MatchLevel;
  if (score >= MATCH_THRESHOLDS.STRONG) level = 'STRONG_MATCH';
  else if (score >= MATCH_THRESHOLDS.GOOD) level = 'GOOD_MATCH';
  else if (score >= MATCH_THRESHOLDS.PARTIAL) level = 'PARTIAL_MATCH';
  else level = 'LOW_MATCH';

  let recommendation: string;
  if (!input.targetsFaculty) {
    recommendation = 'Not open to faculty applicants.';
  } else if (level === 'STRONG_MATCH') {
    recommendation = 'Strong fit — your expertise covers most requirements.';
  } else if (level === 'GOOD_MATCH') {
    recommendation = 'Good fit — you meet most of the requirements.';
  } else if (level === 'PARTIAL_MATCH') {
    recommendation = 'Partial fit — consider highlighting adjacent experience.';
  } else {
    recommendation = 'Low fit — significant expertise gaps to address.';
  }

  return {
    score,
    level,
    recommendation,
    matchedExpertise,
    missingExpertise,
    // `MatchResult` requires these — faculty-side matching does not produce
    // a "missing skills" list (the equivalent is `missingExpertise` above),
    // but the shape contract for the broader type expects them.
    matchedSkills: matchedExpertise,
    missingSkills: missingExpertise,
    extraSkills: [],
    preferredMatched: [],
  };
}
