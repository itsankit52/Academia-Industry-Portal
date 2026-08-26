import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { PublicPortfolio } from '@aip/types';
import { queryKeys } from './queryKeys';

export function usePublicPortfolio(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.portfolio(studentId ?? ''),
    queryFn: () => apiGet<PublicPortfolio>(`/portfolio/${studentId}`),
    enabled: Boolean(studentId),
    retry: false,
  });
}
