import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Assessment } from '@aip/types';
import { queryKeys } from './queryKeys';

export function useLatestAssessment() {
  return useQuery({
    queryKey: queryKeys.student.assessments.latest,
    queryFn: () => apiGet<Assessment | null>('/assessments/me/latest'),
  });
}
