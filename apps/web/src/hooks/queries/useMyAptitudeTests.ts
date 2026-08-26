import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Paginated, AptitudeTestSummary } from '@aip/types';
import type { AptitudeCategory } from '@aip/config';
import { queryKeys } from './queryKeys';

interface Filters {
  page?: number;
  pageSize?: number;
  category?: AptitudeCategory;
  status?: 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
}

export function useMyAptitudeTests(filters: Filters = {}) {
  return useQuery({
    queryKey: queryKeys.aptitude.myTests(filters),
    queryFn: () =>
      apiGet<Paginated<AptitudeTestSummary>>('/aptitude/tests/me', { params: filters }),
  });
}
