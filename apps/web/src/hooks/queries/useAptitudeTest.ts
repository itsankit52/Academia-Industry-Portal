import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { AptitudeTest, AptitudeTestResult } from '@aip/types';
import { queryKeys } from './queryKeys';

export interface AptitudeTestEnvelope {
  test: AptitudeTest;
  result?: AptitudeTestResult;
}

export function useAptitudeTest(id: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.aptitude.test(id),
    queryFn: () => apiGet<AptitudeTestEnvelope>(`/aptitude/tests/${id}`),
    enabled: options.enabled ?? Boolean(id),
  });
}
