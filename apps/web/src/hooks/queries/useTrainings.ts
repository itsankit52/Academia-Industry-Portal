import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Paginated, TrainingProgram } from '@aip/types';
import { queryKeys } from './queryKeys';

export interface TrainingFilters {
  skills?: string[];
  page?: number;
  pageSize?: number;
}

export function useTrainings(filters: TrainingFilters = {}) {
  const params = new URLSearchParams();
  if (filters.skills?.length) {
    filters.skills.forEach((s) => params.append('skill', s));
  }
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 20));

  return useQuery({
    queryKey: queryKeys.trainings(filters),
    queryFn: () => apiGet<Paginated<TrainingProgram>>(`/training?${params.toString()}`),
  });
}
