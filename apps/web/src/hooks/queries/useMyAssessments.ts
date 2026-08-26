import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Paginated, Assessment } from '@aip/types';
import { queryKeys } from './queryKeys';

export function useMyAssessments(page = 1) {
  return useQuery({
    queryKey: queryKeys.student.assessments.list(page),
    queryFn: () => apiGet<Paginated<Assessment>>('/assessments/me', { params: { page, pageSize: 12 } }),
  });
}
