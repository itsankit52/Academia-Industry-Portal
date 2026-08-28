import { useQuery } from '@tanstack/react-query';
import type { OpportunityType } from '@aip/config';
import type { TrainingProgram, MentorProfile, CollaborationEvent } from '@aip/types';
import { apiGet } from '@/lib/api';
import { queryKeys } from './queryKeys';

/** Skill gap item returned by the recommendations engine. */
export interface SkillGapItem {
  id: string;
  name: string;
  category: string;
  count: number;
}

/** A training programme with its overlap against the student's missing skills. */
export interface RecommendedTrainingItem {
  training: TrainingProgram;
  overlapCount: number;
  overlapSkillIds: string[];
}

/** A mentor whose expertise overlaps with the student's missing skills. */
export interface RecommendedMentorItem {
  mentor: MentorProfile;
  expertiseMatch: string[];
  expertiseMatchCount: number;
}

/** A workshop/event whose tags overlap with the student's missing skills. */
export interface RecommendedWorkshopItem {
  event: CollaborationEvent;
  tagMatch: string[];
  tagMatchCount: number;
}

/** The unified learning recommendations response. */
export interface LearningRecommendations {
  trainings: RecommendedTrainingItem[];
  mentors: RecommendedMentorItem[];
  workshops: RecommendedWorkshopItem[];
  missingSkills: SkillGapItem[];
  targetOpportunityId?: string;
  targetOpportunityType?: OpportunityType;
}

export interface LearningRecommendationsParams {
  targetOpportunityId?: string;
  targetOpportunityType?: OpportunityType;
}

export function useLearningRecommendations(params?: LearningRecommendationsParams) {
  const qs = new URLSearchParams();
  if (params?.targetOpportunityId) qs.set('targetOpportunityId', params.targetOpportunityId);
  if (params?.targetOpportunityType) qs.set('targetOpportunityType', params.targetOpportunityType);
  const query = qs.toString() ? `?${qs.toString()}` : '';

  return useQuery({
    queryKey: queryKeys.learningRecommendations(params),
    queryFn: () => apiGet<LearningRecommendations>(`/recommendations/learning${query}`),
  });
}
