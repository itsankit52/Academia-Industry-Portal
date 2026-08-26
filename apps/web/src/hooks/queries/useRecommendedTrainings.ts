import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { TrainingProgram } from '@aip/types';
import { queryKeys } from './queryKeys';

/** `GET /training/recommended` scores each programme by skill overlap. */
export interface RecommendedTrainingProgram {
  training: TrainingProgram;
  overlap: number;
}

/**
 * The endpoint answers with `{ items: [...] }` wrapping a scored item, not a bare
 * array of programmes. Typing it as `TrainingProgram[]` made `data.length` read
 * `undefined`, so the "Recommended for You" section never rendered at all.
 */
export function useRecommendedTrainings() {
  return useQuery({
    queryKey: queryKeys.recommendedTrainings(),
    queryFn: () => apiGet<{ items: RecommendedTrainingProgram[] }>('/training/recommended'),
  });
}
