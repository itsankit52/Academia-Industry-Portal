/**
 * Phase 9B — Career benchmark / peer comparison hook.
 *
 * Calls GET /api/recommendations/me/benchmark and returns the aggregate-only
 * CareerBenchmark payload. The hook never exposes peer identities — the
 * service does the filtering server-side.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { CareerBenchmark } from '@aip/types';
import { queryKeys } from './queryKeys';

export function useCareerBenchmark() {
  return useQuery({
    queryKey: queryKeys.careerBenchmark(),
    queryFn: () => apiGet<CareerBenchmark>('/recommendations/me/benchmark'),
    staleTime: 10 * 60 * 1000, // benchmarks change slowly
  });
}
