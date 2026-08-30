import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { PersonalizedRecommendations } from '@aip/types';
import { queryKeys } from './queryKeys';

export type { PersonalizedRecommendations };

export function usePersonalizedRecommendations() {
  return useQuery({
    queryKey: queryKeys.recommendations('personalized'),
    queryFn: () => apiGet<PersonalizedRecommendations>('/recommendations/me'),
    staleTime: 5 * 60 * 1000, // 5 minutes — recommendations are derived, not live
  });
}
