/**
 * Full multi-dimensional match between a student and an opportunity.
 *
 * All functions in this file are pure, synchronous and AI-free. The DB I/O
 * lives in fullMatch.service.ts.
 */

import type { Proficiency } from '@aip/config';
import type {
  GapSkill,
  FullMatchResult,
  FullMatchEligibility,
  FullMatchCareerInterests,
  FullMatchBreakdown,
  ProficiencyGapSkill,
  MatchExplanation,
  MatchReason,
  MatchWarning,
} from '@aip/types';
import type { MatchLevel } from '@aip/config';
import { FULL_MATCH_WEIGHTS, MATCH_THRESHOLDS } from '@aip/config';
import { scoreMatch, type MatchCounts } from './algorithm';

// Re-export so callers can import everything from this module.
export type { FullMatchResult } from '@aip/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROFICIENCY_ORDER: Record<Proficiency, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

const PROFICIENCY_LABELS: Record<Proficiency, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface FullMatchTechnicalSkill {
  id: string;
  name: string;
  /** Student's proficiency level in this skill (null if not added). */
  proficiency?: Proficiency | null;
  /** Industry demand weight for this skill (0-1 scale, higher = more demanded). */
  demandWeight?: number;
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

export interface IndustryDemandSignal {
  skillId: string;
  demandCount: number;
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

  // Industry demand — count of opportunities requiring each skill (for demand weighting)
  industryDemand?: IndustryDemandSignal[];
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
 * Preserves the proficiency and demandWeight from the first occurrence.
 */
function toTechnicalSet(
  skills: FullMatchTechnicalSkill[] | null | undefined,
): Map<string, FullMatchTechnicalSkill> {
  const map = new Map<string, FullMatchTechnicalSkill>();
  if (!Array.isArray(skills)) return map;
  for (const entry of skills) {
    if (!entry || entry.name === null || entry.name === undefined) continue;
    const name = nameKey(entry.name);
    if (!name) continue;
    if (!map.has(name)) {
      map.set(name, {
        id: entry.id,
        name: String(entry.name).trim(),
        proficiency: entry.proficiency ?? null,
        demandWeight: entry.demandWeight ?? 0,
      });
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
  student: Map<string, FullMatchTechnicalSkill>,
  required: Map<string, FullMatchTechnicalSkill>,
  preferred: Map<string, FullMatchTechnicalSkill>,
): MatchCounts {
  let requiredMatched = 0;
  for (const name of required.keys()) {
    if (student.has(name)) requiredMatched++;
  }

  // Exclude skills already in required from the preferred pool
  const effectivePreferred = new Map<string, FullMatchTechnicalSkill>();
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
// Proficiency matching
// ---------------------------------------------------------------------------

/**
 * Computes proficiency-based score and per-skill gaps.
 *
 * The required skill's own proficiency (if set) is treated as the minimum
 * level. A skill the student has but at a lower level is recorded as a
 * `proficiencyGap`; a skill the student is missing is recorded as missing
 * (gap = required level). When neither is set, the function returns 100
 * (nothing to check) rather than 0.
 */
export function scoreProficiencyGaps(
  student: Map<string, FullMatchTechnicalSkill>,
  required: Map<string, FullMatchTechnicalSkill>,
): { score: number; gaps: ProficiencyGapSkill[] } {
  if (required.size === 0) return { score: 100, gaps: [] };

  let totalLevel = 0;
  let achievedLevel = 0;
  const gaps: ProficiencyGapSkill[] = [];

  for (const [name, requiredSkill] of required) {
    const requiredLevel = requiredSkill.proficiency ?? null;
    // No proficiency requirement stated for this skill → it's met at any level,
    // so it contributes nothing to the proficiency score (no penalty, no bonus).
    if (requiredLevel === null) {
      continue;
    }
    const requiredRank = PROFICIENCY_ORDER[requiredLevel];
    const studentSkill = student.get(name);
    totalLevel += requiredRank;
    if (!studentSkill) {
      // Student hasn't added the skill at all — full gap.
      gaps.push({
        id: requiredSkill.id,
        name: requiredSkill.name,
        requiredLevel,
        studentLevel: null,
        gapLevels: requiredRank,
        missing: true,
      });
      continue;
    }
    const studentRank = studentSkill.proficiency ? PROFICIENCY_ORDER[studentSkill.proficiency] : 0;
    achievedLevel += Math.min(studentRank, requiredRank);
    if (studentRank < requiredRank) {
      gaps.push({
        id: requiredSkill.id,
        name: requiredSkill.name,
        requiredLevel,
        studentLevel: studentSkill.proficiency ?? null,
        gapLevels: requiredRank - studentRank,
        missing: false,
      });
    }
  }

  const score = totalLevel === 0 ? 100 : Math.round((achievedLevel / totalLevel) * 100);
  return { score, gaps };
}

// ---------------------------------------------------------------------------
// Industry demand matching
// ---------------------------------------------------------------------------

/**
 * Computes how well the student's required-skill coverage aligns with industry
 * demand. The denominator is the total industry demand for the opportunity's
 * required skills; the numerator is the demand-weighted count of those skills
 * the student already holds.
 */
export function scoreIndustryDemand(
  student: Map<string, FullMatchTechnicalSkill>,
  required: Map<string, FullMatchTechnicalSkill>,
  industryDemand: IndustryDemandSignal[] | undefined,
): number {
  if (required.size === 0) return 100;
  if (!Array.isArray(industryDemand) || industryDemand.length === 0) return 100;

  const demandById = new Map<string, number>();
  for (const signal of industryDemand) {
    if (typeof signal.skillId === 'string' && typeof signal.demandCount === 'number') {
      demandById.set(signal.skillId, signal.demandCount);
    }
  }

  let totalDemand = 0;
  let achievedDemand = 0;
  for (const [name, requiredSkill] of required) {
    // Use the demand weight carried on the required skill, falling back to the
    // cross-opportunity demand map keyed by id.
    const fromWeight = requiredSkill.demandWeight ?? 0;
    const fromMap = requiredSkill.id ? (demandById.get(requiredSkill.id) ?? 0) : 0;
    const weight = Math.max(fromWeight, fromMap);
    if (weight === 0) {
      // No demand signal → neutral; count as met so it doesn't drag the score down.
      totalDemand += 1;
      if (student.has(name)) achievedDemand += 1;
      continue;
    }
    totalDemand += weight;
    if (student.has(name)) achievedDemand += weight;
  }

  return totalDemand === 0 ? 100 : Math.round((achievedDemand / totalDemand) * 100);
}

// ---------------------------------------------------------------------------
// Explanation builder
// ---------------------------------------------------------------------------

function buildExplanation(params: {
  matchedTechnical: GapSkill[];
  missingTechnical: GapSkill[];
  proficiencyGaps: ProficiencyGapSkill[];
  softResult: { matched: string[]; missing: string[] };
  careerResult: FullMatchCareerInterests;
  eligibility: { passed: boolean; failures: string[] };
  technicalScore: number;
  proficiencyScore: number;
  industryDemandScore: number;
  requiredTotal: number;
}): MatchExplanation {
  const reasons: MatchReason[] = [];
  const warnings: MatchWarning[] = [];

  // Skill match reasons
  if (params.matchedTechnical.length > 0) {
    const topMatched = params.matchedTechnical.slice(0, 3).map((s) => s.name);
    reasons.push({
      kind: 'SKILL_MATCH',
      message: `You have ${params.matchedTechnical.length} matching skill${params.matchedTechnical.length !== 1 ? 's' : ''}: ${topMatched.join(', ')}${params.matchedTechnical.length > 3 ? ` and ${params.matchedTechnical.length - 3} more` : ''}.`,
    });
  }

  // Career interest alignment
  if (params.careerResult.matched.length > 0) {
    reasons.push({
      kind: 'CAREER_INTEREST',
      message: `Matches your career interest: ${params.careerResult.matched[0]}${params.careerResult.matched.length > 1 ? ` and ${params.careerResult.matched.length - 1} more` : ''}.`,
    });
  }

  // Eligibility
  if (params.eligibility.passed) {
    reasons.push({
      kind: 'ELIGIBILITY',
      message: 'You meet all eligibility criteria for this role.',
    });
  }

  // Proficiency gaps as warnings
  for (const gap of params.proficiencyGaps.slice(0, 3)) {
    if (gap.missing) {
      warnings.push({
        kind: 'MISSING_SKILL',
        message: `Missing ${gap.name} — required at ${PROFICIENCY_LABELS[gap.requiredLevel]} level.`,
      });
    } else {
      warnings.push({
        kind: 'PROFICIENCY_GAP',
        message: `Improve ${gap.name} from ${PROFICIENCY_LABELS[gap.studentLevel!]} to ${PROFICIENCY_LABELS[gap.requiredLevel]}.`,
      });
    }
  }

  // Missing skills warnings (top 2 not already in proficiency gaps)
  const missingNames = new Set(params.proficiencyGaps.filter((g) => g.missing).map((g) => g.name));
  const otherMissing = params.missingTechnical.filter((s) => !missingNames.has(s.name)).slice(0, 2);
  for (const skill of otherMissing) {
    warnings.push({
      kind: 'MISSING_SKILL',
      message: `Missing ${skill.name}.`,
    });
  }

  // Eligibility failures
  if (!params.eligibility.passed) {
    for (const failure of params.eligibility.failures.slice(0, 2)) {
      warnings.push({
        kind: 'INELIGIBLE',
        message: failure,
      });
    }
  }

  return {
    reasons,
    warnings,
    skillRatio: {
      matched: params.matchedTechnical.length,
      total: params.requiredTotal,
    },
  };
}

// ---------------------------------------------------------------------------
// Main pure function
// ---------------------------------------------------------------------------

/**
 * The deterministic mathematical matching engine.
 *
 * Score composition (sums to 100):
 *   TECHNICAL       × 0.50   — deterministic weighted score from required + preferred skills
 *   PROFICIENCY     × 0.10   — how well student's proficiency meets required levels
 *   SOFT            × 0.10   — soft-skill overlap
 *   CAREER          × 0.10   — career-interest overlap
 *   INDUSTRY_DEMAND × 0.10   — how much of industry's demand the student covers
 *   ELIGIBILITY     × 0.10   — bonus applied only when all eligibility gates pass
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

  // ----- Proficiency gaps -----
  const proficiencyResult = scoreProficiencyGaps(studentSet, requiredSet);

  // ----- Industry demand -----
  const industryDemandScore = scoreIndustryDemand(studentSet, requiredSet, input.industryDemand);

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
  const proficiencyFraction = proficiencyResult.score * FULL_MATCH_WEIGHTS.PROFICIENCY;
  const softFraction = softResult.score * FULL_MATCH_WEIGHTS.SOFT;
  const careerFraction = careerResult.score * FULL_MATCH_WEIGHTS.CAREER;
  const demandFraction = industryDemandScore * FULL_MATCH_WEIGHTS.INDUSTRY_DEMAND;
  const eligibilityBonus = eligibility.passed ? FULL_MATCH_WEIGHTS.ELIGIBILITY : 0;

  const score = Math.min(
    100,
    Math.round(
      technicalFraction +
        proficiencyFraction +
        softFraction +
        careerFraction +
        demandFraction +
        eligibilityBonus,
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
    proficiency: proficiencyResult.score,
    soft: softResult.score,
    career: careerResult.score,
    industryDemand: industryDemandScore,
    eligibility: eligibility.passed ? 100 : 0,
  };

  const explanation = buildExplanation({
    matchedTechnical,
    missingTechnical,
    proficiencyGaps: proficiencyResult.gaps,
    softResult,
    careerResult,
    eligibility,
    technicalScore,
    proficiencyScore: proficiencyResult.score,
    industryDemandScore,
    requiredTotal: counts.requiredTotal,
  });

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
    proficiencyGaps: proficiencyResult.gaps,
    preferredMatched,
    careerInterestsMatch: careerResult,
    breakdown,
    explanation,
  };
}
