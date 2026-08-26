import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { AssessmentSummary } from '@aip/types';
import { queryKeys } from './queryKeys';

export function useAssessmentSummary() {
  return useQuery({
    queryKey: queryKeys.student.assessments.summary,
    queryFn: () => apiGet<AssessmentSummary>('/assessments/me/summary'),
  });
}
