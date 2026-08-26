import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { AptitudeCategoryCount } from '@aip/types';
import { queryKeys } from './queryKeys';

export function useAptitudeCategories() {
  return useQuery({
    queryKey: queryKeys.aptitude.categories(),
    queryFn: () => apiGet<AptitudeCategoryCount[]>('/aptitude/categories'),
  });
}
