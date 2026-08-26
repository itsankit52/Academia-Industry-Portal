import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Assessment } from '@aip/types';
import { queryKeys } from './queryKeys';

export function useAssessment(id: string) {
  return useQuery({
    queryKey: queryKeys.student.assessments.detail(id),
    queryFn: () => apiGet<Assessment>(`/assessments/${id}`),
    enabled: !!id,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
}
