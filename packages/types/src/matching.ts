import type { MatchLevel, Proficiency } from '@aip/config';

export interface MatchResult {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  extraSkills: string[];
  preferredMatched: string[];
  level: MatchLevel;
  recommendation: string;
}

/** Reuses GapSkill from skillGap so name+id are available for UI rendering. */
export interface FullMatchEligibility {
  passed: boolean;
  failures: string[];
}

export interface FullMatchCareerInterests {
  matched: string[];
  missing: string[];
  score: number;
}

export interface FullMatchBreakdown {
  technical: number;
  /** Proficiency-based score (0-100) measuring how well student's proficiency level meets required levels. */
  proficiency: number;
  soft: number;
  career: number;
  /** Industry demand alignment (0-100) — how much of the required demand the student covers. */
  industryDemand: number;
  eligibility: number;
}

export interface ProficiencyGapSkill extends GapSkill {
  requiredLevel: Proficiency;
  studentLevel: Proficiency | null;
  /** 0 = no gap, 1-4 = number of proficiency steps below the required level. */
  gapLevels: number;
  /** True if the student hasn't added this skill at all. */
  missing: boolean;
}

export interface FullMatchResult {
  score: number;
  matchPercentage: number;
  level: MatchLevel;
  recommendation: string;
  eligibility: FullMatchEligibility;
  matchedSkills: {
    technical: GapSkill[];
    soft: string[];
  };
  missingSkills: {
    technical: GapSkill[];
    soft: string[];
  };
  /** Skills the student holds but below the required proficiency level. */
  proficiencyGaps: ProficiencyGapSkill[];
  preferredMatched: GapSkill[];
  careerInterestsMatch: FullMatchCareerInterests;
  breakdown: FullMatchBreakdown;
  /** Structured explanation: "why this matches you" — built from real data, not hardcoded. */
  explanation: MatchExplanation;
}

export interface MatchExplanation {
  reasons: MatchReason[];
  warnings: MatchWarning[];
  /** The matched/total ratio expressed as "X/Y required skills" for display. */
  skillRatio: { matched: number; total: number };
}

export interface MatchReason {
  kind: 'SKILL_MATCH' | 'CAREER_INTEREST' | 'ELIGIBILITY' | 'PROFICIENCY' | 'PREFERRED' | 'DEMAND';
  message: string;
}

export interface MatchWarning {
  kind: 'PROFICIENCY_GAP' | 'MISSING_SKILL' | 'INELIGIBLE';
  message: string;
}

/**
 * Exposed from @aip/types so the service wrapper can import it without
 * pulling in the whole GapSkill interface from skillGap (which lives in the api).
 */
export interface GapSkill {
  id: string;
  name: string;
}

/**
 * The structured response produced by Gemini for the AI-powered skill gap analysis.
 * All fields are optional — the caller always falls back to the deterministic
 * math when Gemini is unavailable, times out, or returns malformed data.
 */
export interface AiSkillGapAnalysis {
  /** Skills the student is missing relative to the opportunity. */
  skillGaps: string[];
  /** Identified strengths the student brings to the opportunity. */
  strengths: string[];
  /** Concrete, actionable suggestions for the student to become a stronger fit. */
  recommendedSkills: string[];
  /** A prose explanation of the match score and how it was derived. */
  matchExplanation: string;
}
