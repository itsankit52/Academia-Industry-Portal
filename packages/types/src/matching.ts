import type { MatchLevel } from '@aip/config';

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
  soft: number;
  career: number;
  eligibility: number;
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
  preferredMatched: GapSkill[];
  careerInterestsMatch: FullMatchCareerInterests;
  breakdown: FullMatchBreakdown;
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
