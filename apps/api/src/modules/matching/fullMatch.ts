/**
 * Full multi-dimensional match between a student and an opportunity.
 *
 * All functions in this file are pure, synchronous and AI-free. The DB I/O
 * lives in fullMatch.service.ts.
 */

import type {
  GapSkill,
  FullMatchResult,
  FullMatchEligibility,
  FullMatchCareerInterests,
  FullMatchBreakdown,
} from '@aip/types';
import type { MatchLevel } from '@aip/config';
import { FULL_MATCH_WEIGHTS, MATCH_THRESHOLDS } from '@aip/config';
import { scoreMatch, type MatchCounts } from './algorithm';

// Re-export so callers can import everything from this module.
export type { FullMatchResult } from '@aip/types';

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface FullMatchTechnicalSkill {
  id: string;
  name: string;
}

export interface FullMatchSoftSkill {
  name: string;
}

export interface FullMatchEligibilityInput {
  studentCgpa?: number | null | undefined;
  studentBranch?: string | null | undefined;
  studentGraduationYear?: number | null | undefined;
  studentDegree?: string | null | undefined;
  requiredCgpa?: number | null | undefined;
  eligibleBranches?: string[] | null | undefined;
  eligibleGradYears?: number[] | null | undefined;
  eligibleDegrees?: string[] | null | undefined;
}

/** All data needed to compute the match — normalised from DB records. */
export interface FullMatchInput {
  // Technical skills (GapSkill shape from skillGap.ts)
  studentSkills: FullMatchTechnicalSkill[];
  requiredSkills: FullMatchTechnicalSkill[];
  preferredSkills: FullMatchTechnicalSkill[];

  // Soft skills — plain strings, matched by normalised name
  studentSoftSkills: FullMatchSoftSkill[];
  preferredSoftSkills: FullMatchSoftSkill[];

  // Eligibility — omitted when the caller wants to skip this dimension
  eligibility?: FullMatchEligibilityInput;

  // Career interests — plain strings (null/blank is treated as empty)
  studentCareerInterests?: string[] | null | undefined;
  opportunityPreferredRoles?: string[] | null | undefined;
  opportunityPreferredLocations?: string[] | null | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalises a skill name for comparison: lowercase, trimmed, single spaces. */
function nameKey(name: string | null | undefined): string {
  if (name === null || name === undefined) return '';
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Converts a list of technical skills to a unique-keyed map so duplicate names
 * collapse to a single entry and the set can be used for O(1) lookup.
 */
function toTechnicalSet(
  skills: FullMatchTechnicalSkill[] | null | undefined,
): Map<string, GapSkill> {
  const map = new Map<string, GapSkill>();
  if (!Array.isArray(skills)) return map;
  for (const entry of skills) {
    if (!entry || entry.name === null || entry.name === undefined) continue;
    const name = nameKey(entry.name);
    if (!name) continue;
    if (!map.has(name)) {
      map.set(name, { id: entry.id, name: String(entry.name).trim() });
    }
  }
  return map;
}

/**
 * Converts soft skills to a set of normalised names for O(1) lookup.
 * Preserves all entries so we can report which specific skills were matched.
 */
function toSoftSet(skills: FullMatchSoftSkill[] | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(skills)) return map;
  for (const entry of skills) {
    if (!entry || entry.name === null || entry.name === undefined) continue;
    const name = nameKey(entry.name);
    if (!name) continue;
    map.set(name, String(entry.name).trim());
  }
  return map;
}

/**
 * Converts career interests to a set of normalised strings for O(1) lookup.
 */
function toCareerSet(interests: string[] | null | undefined): Set<string> {
  const set = new Set<string>();
  if (!Array.isArray(interests)) return set;
  for (const interest of interests) {
    if (interest === null || interest === undefined) continue;
    const key = nameKey(String(interest));
    if (key) set.add(key);
  }
  return set;
}

// ---------------------------------------------------------------------------
// Eligibility check
// ---------------------------------------------------------------------------

/**
 * Checks whether a student clears all eligibility gates on an opportunity.
 * Each criterion that is absent/null on the opportunity is treated as open
 * (not a failure) so the function never blocks a student on an unset field.
 *
 * - CGPA: studentCgpa >= requiredCgpa
 * - Branch: studentBranch appears in eligibleBranches (case-insensitive)
 * - Grad year: studentGraduationYear appears in eligibleGradYears
 * - Degree: studentDegree appears in eligibleDegrees (case-insensitive)
 */
export function checkEligibility(input: FullMatchEligibilityInput): FullMatchEligibility {
  const failures: string[] = [];

  if (
    input.requiredCgpa !== null &&
    input.requiredCgpa !== undefined &&
    input.studentCgpa !== null &&
    input.studentCgpa !== undefined
  ) {
    if (input.studentCgpa < input.requiredCgpa) {
      failures.push(`CGPA ${input.studentCgpa} is below the required ${input.requiredCgpa}`);
    }
  }

  if (input.eligibleBranches && input.eligibleBranches.length > 0 && input.studentBranch) {
    const studentBranch = nameKey(input.studentBranch);
    const matches = input.eligibleBranches.some((b) => nameKey(b) === studentBranch);
    if (!matches) {
      failures.push(`Branch "${input.studentBranch}" is not among the eligible branches`);
    }
  }

  if (
    input.eligibleGradYears &&
    input.eligibleGradYears.length > 0 &&
    input.studentGraduationYear !== null &&
    input.studentGraduationYear !== undefined
  ) {
    if (!input.eligibleGradYears.includes(input.studentGraduationYear)) {
      failures.push(
        `Graduation year ${input.studentGraduationYear} is not in the eligible years list`,
      );
    }
  }

  if (input.eligibleDegrees && input.eligibleDegrees.length > 0 && input.studentDegree) {
    const studentDegree = nameKey(input.studentDegree);
    const matches = input.eligibleDegrees.some((d) => nameKey(d) === studentDegree);
    if (!matches) {
      failures.push(`Degree "${input.studentDegree}" is not among the eligible degrees`);
    }
  }

  return { passed: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Soft-skill matching
// ---------------------------------------------------------------------------

export interface SoftSkillMatchResult {
  matched: string[];
  missing: string[];
  score: number;
}

/**
 * Returns the names of preferred soft skills that the student holds (matched) and
 * those they don't (missing).  Score is matched / total * 100, or 100 when the
 * opportunity lists none (nothing to fail).
 */
export function scoreSoftSkills(
  studentSoftSkills: FullMatchSoftSkill[],
  preferredSoftSkills: FullMatchSoftSkill[],
): SoftSkillMatchResult {
  // Build a name-keyed list of preferred soft skills, dropping null/blank names
  // so they neither count as a match nor inflate the denominator.
  const preferredKeys: string[] = [];
  for (const skill of preferredSoftSkills ?? []) {
    if (!skill || skill.name === null || skill.name === undefined) continue;
    const key = nameKey(skill.name);
    if (key) preferredKeys.push(key);
  }
  if (preferredKeys.length === 0) {
    return { matched: [], missing: [], score: 100 };
  }

  const studentSet = toSoftSet(studentSoftSkills);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const key of preferredKeys) {
    if (studentSet.has(key)) {
      matched.push(studentSet.get(key)!);
    } else {
      // Use the original casing the student would recognise.
      const original = (preferredSoftSkills ?? []).find(
        (s) => s && s.name !== null && s.name !== undefined && nameKey(s.name) === key,
      );
      missing.push(
        original && original.name !== null && original.name !== undefined
          ? String(original.name).trim()
          : key,
      );
    }
  }

  const score = Math.round((matched.length / preferredKeys.length) * 100);

  return { matched, missing, score };
}

// ---------------------------------------------------------------------------
// Career-interest matching
// ---------------------------------------------------------------------------

/**
 * Checks overlap between the student's career interests and the opportunity's
 * preferred roles and locations.  All four strings sets are merged into one
 * pool of "what this opportunity is looking for" so "Frontend Developer" and
 * "Mumbai" are both weighted equally as interest signals.
 */
export function scoreCareerInterests(
  studentCareerInterests: string[],
  opportunityPreferredRoles: string[],
  opportunityPreferredLocations: string[],
): FullMatchCareerInterests {
  const oppSet = new Set<string>();

  for (const role of opportunityPreferredRoles ?? []) {
    oppSet.add(nameKey(role));
  }
  for (const loc of opportunityPreferredLocations ?? []) {
    oppSet.add(nameKey(loc));
  }

  if (oppSet.size === 0) {
    return { matched: [], missing: [], score: 100 };
  }

  const studentSet = toCareerSet(studentCareerInterests);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const key of oppSet) {
    if (studentSet.has(key)) {
      // Use the student's original-cased interest for display
      const original = studentCareerInterests.find((i) => nameKey(i) === key);
      matched.push(original ?? key);
    } else {
      missing.push(key);
    }
  }

  const score = Math.round((matched.length / oppSet.size) * 100);

  return { matched, missing, score };
}

// ---------------------------------------------------------------------------
// Technical skill matching (wraps scoreMatch)
// ---------------------------------------------------------------------------

/** Converts the full-match skill format into the counts shape scoreMatch expects. */
function technicalMatchCounts(
  student: Map<string, GapSkill>,
  required: Map<string, GapSkill>,
  preferred: Map<string, GapSkill>,
): MatchCounts {
  let requiredMatched = 0;
  for (const name of required.keys()) {
    if (student.has(name)) requiredMatched++;
  }

  // Exclude skills already in required from the preferred pool
  const effectivePreferred = new Map<string, GapSkill>();
  for (const [name, skill] of preferred) {
    if (!required.has(name)) effectivePreferred.set(name, skill);
  }

  let preferredMatched = 0;
  for (const name of effectivePreferred.keys()) {
    if (student.has(name)) preferredMatched++;
  }

  return {
    requiredTotal: required.size,
    requiredMatched,
    preferredTotal: effectivePreferred.size,
    preferredMatched,
  };
}

// ---------------------------------------------------------------------------
// Main pure function
// ---------------------------------------------------------------------------

/**
 * The deterministic mathematical matching engine.
 *
 * Score composition (sums to 100):
 *   TECHNICAL  × 0.70   — deterministic weighted score from required + preferred skills
 *   SOFT       × 0.10   — soft-skill overlap
 *   CAREER     × 0.10   — career-interest overlap
 *   ELIGIBILITY × 0.10  — bonus applied only when all eligibility gates pass
 *
 * Eligibility failures do NOT reduce the score to zero — they are surfaced
 * separately as `eligibility.passed / eligibility.failures` so the student can
 * see both their percentage and exactly why they may be screened out.
 */
export function computeFullMatch(input: FullMatchInput): FullMatchResult {
  const studentSet = toTechnicalSet(input.studentSkills);
  const requiredSet = toTechnicalSet(input.requiredSkills);
  const preferredSet = toTechnicalSet(input.preferredSkills);

  // Eligibility is allowed to be omitted in tests; treat as empty (all-open).
  const eligibilityInput = input.eligibility ?? {};

  // ----- Technical skills -----
  const counts = technicalMatchCounts(studentSet, requiredSet, preferredSet);
  const { score: technicalScore } = scoreMatch(counts);

  // Compute matched/missing/preferredMatched for the result payload
  const matchedTechnical: GapSkill[] = [];
  const missingTechnical: GapSkill[] = [];
  const preferredMatched: GapSkill[] = [];

  for (const [name, skill] of requiredSet) {
    if (studentSet.has(name)) matchedTechnical.push(skill);
    else missingTechnical.push(skill);
  }

  for (const [name, skill] of preferredSet) {
    if (!requiredSet.has(name) && studentSet.has(name)) {
      preferredMatched.push(skill);
    }
  }

  // ----- Soft skills -----
  const softResult = scoreSoftSkills(
    input.studentSoftSkills ?? [],
    input.preferredSoftSkills ?? [],
  );

  // ----- Career interests -----
  const careerResult = scoreCareerInterests(
    input.studentCareerInterests ?? [],
    input.opportunityPreferredRoles ?? [],
    input.opportunityPreferredLocations ?? [],
  );

  // ----- Eligibility -----
  const eligibility = checkEligibility(eligibilityInput);

  // ----- Final score -----
  const technicalFraction = technicalScore * FULL_MATCH_WEIGHTS.TECHNICAL;
  const softFraction = softResult.score * FULL_MATCH_WEIGHTS.SOFT;
  const careerFraction = careerResult.score * FULL_MATCH_WEIGHTS.CAREER;
  const eligibilityBonus = eligibility.passed ? FULL_MATCH_WEIGHTS.ELIGIBILITY : 0;

  const score = Math.min(
    100,
    Math.round(
      technicalFraction / 100 + softFraction / 100 + careerFraction / 100 + eligibilityBonus,
    ),
  );

  // matchPercentage mirrors the old skill-gap percentage: how many of the
  // required technical skills does the student hold?
  const matchPercentage =
    requiredSet.size === 0 ? 100 : Math.round((matchedTechnical.length / requiredSet.size) * 100);

  // Level uses the same thresholds as the existing match levels.
  let level: MatchLevel;
  if (score >= MATCH_THRESHOLDS.STRONG) level = 'STRONG_MATCH';
  else if (score >= MATCH_THRESHOLDS.GOOD) level = 'GOOD_MATCH';
  else if (score >= MATCH_THRESHOLDS.PARTIAL) level = 'PARTIAL_MATCH';
  else level = 'LOW_MATCH';

  let recommendation: string;
  if (eligibility.passed) {
    switch (level) {
      case 'STRONG_MATCH':
        recommendation = 'Excellent fit — you meet nearly all requirements and are fully eligible.';
        break;
      case 'GOOD_MATCH':
        recommendation = 'Good fit — you meet most core requirements and are eligible.';
        break;
      case 'PARTIAL_MATCH':
        recommendation = 'Partial fit — consider building the missing skills.';
        break;
      default:
        recommendation = 'Low fit — significant gaps to address before applying.';
    }
  } else {
    recommendation =
      'You appear ineligible for this opportunity. Review the eligibility criteria before applying.';
  }

  const breakdown: FullMatchBreakdown = {
    technical: technicalScore,
    soft: softResult.score,
    career: careerResult.score,
    eligibility: eligibility.passed ? 100 : 0,
  };

  return {
    score,
    matchPercentage,
    level,
    recommendation,
    eligibility,
    matchedSkills: {
      technical: matchedTechnical,
      soft: softResult.matched,
    },
    missingSkills: {
      technical: missingTechnical,
      soft: softResult.missing,
    },
    preferredMatched,
    careerInterestsMatch: careerResult,
    breakdown,
  };
}
