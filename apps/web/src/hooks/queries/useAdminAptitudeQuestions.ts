import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { AptitudeCategory } from '@aip/config';
import type { AptitudeQuestion, Paginated } from '@aip/types';
import { queryKeys } from './queryKeys';

interface Filters {
  page?: number;
  pageSize?: number;
  category?: AptitudeCategory;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  status?: 'ACTIVE' | 'ARCHIVED';
  search?: string;
}

export function useAdminAptitudeQuestions(filters: Filters = {}) {
  return useQuery({
    queryKey: queryKeys.aptitude.adminQuestions(filters),
    queryFn: () =>
      apiGet<Paginated<AptitudeQuestion>>('/admin/aptitude-questions', { params: filters }),
  });
}
