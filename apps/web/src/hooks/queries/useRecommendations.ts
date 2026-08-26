import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Job, Internship, MatchResult, Paginated, Skill, TrainingProgram } from '@aip/types';
import { queryKeys } from './queryKeys';

export type RecommendationKind = 'jobs' | 'internships' | 'trainings';

/** `matchResult` reports skills as ids; the API resolves the names alongside it. */
export type NamedSkill = Pick<Skill, 'id' | 'name'>;

export interface RecommendedJob {
  job: Job;
  matchResult: MatchResult;
  matchedSkills: NamedSkill[];
  missingSkills: NamedSkill[];
  eligible: boolean;
}

export interface RecommendedInternship {
  internship: Internship;
  matchResult: MatchResult;
  matchedSkills: NamedSkill[];
  missingSkills: NamedSkill[];
  eligible: boolean;
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
