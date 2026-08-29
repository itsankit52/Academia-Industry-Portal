import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Job, Internship, MatchResult, Paginated, Skill, TrainingProgram } from '@aip/types';
import type { Proficiency } from '@aip/config';
import { queryKeys } from './queryKeys';

export type RecommendationKind = 'jobs' | 'internships' | 'trainings';

/** `matchResult` reports skills as ids; the API resolves the names alongside it. */
export type NamedSkill = Pick<Skill, 'id' | 'name'>;

/**
 * Deterministic "why this matches you" insight returned by the recommendations
 * API. Built from real data, never AI-generated.
 */
export interface OpportunityMatchInsight {
  /** Career interests that overlap with the opportunity's title/role. */
  careerInterestsMatch: string[];
  /** Up to 2 missing skills to highlight as warnings. */
  topMissingSkills: string[];
  /** One-line deterministic summary. */
  summary: string;
}

/** Phase 4: per-skill proficiency gap surfaced on recommendation cards. */
export interface ProficiencyGapItem {
  id: string;
  name: string;
  requiredLevel: Proficiency;
  studentLevel: Proficiency | null;
  /** Number of proficiency steps below the required level (1-3). */
  gapLevels: number;
  /** True if the student hasn't added this skill at all. */
  missing: boolean;
}

export interface RecommendedJob {
  job: Job;
  matchResult: MatchResult;
  matchedSkills: NamedSkill[];
  missingSkills: NamedSkill[];
  eligible: boolean;
  /** Deterministic insight explaining why this job matches. */
  insight: OpportunityMatchInsight;
  /** Phase 4: per-skill proficiency gaps. */
  proficiencyGaps: ProficiencyGapItem[];
}

export interface RecommendedInternship {
  internship: Internship;
  matchResult: MatchResult;
  matchedSkills: NamedSkill[];
  missingSkills: NamedSkill[];
  eligible: boolean;
  /** Deterministic insight explaining why this internship matches. */
  insight: OpportunityMatchInsight;
  /** Phase 4: per-skill proficiency gaps. */
  proficiencyGaps: ProficiencyGapItem[];
}

export interface RecommendedTraining {
  training: TrainingProgram;
  overlapCount: number;
  overlapSkillIds: string[];
}

type RecommendationItem<K extends RecommendationKind> = K extends 'jobs'
  ? RecommendedJob
  : K extends 'internships'
    ? RecommendedInternship
    : RecommendedTraining;

/**
 * All three recommendation endpoints return a paginated envelope wrapping a
 * scored item, not a bare array of opportunities. This hook used to declare the
 * response as `Job[]`, so `data.length` read `undefined` — which is neither `0`
 * nor `> 0`, leaving the page with no list and no empty state either.
 */
export function useRecommendations<K extends RecommendationKind>(kind: K) {
  return useQuery({
    queryKey: queryKeys.recommendations(kind),
    queryFn: () => apiGet<Paginated<RecommendationItem<K>>>(`/recommendations/${kind}`),
  });
}
