/**
 * Phase 9B — Readiness progression hook.
 *
 * Calls GET /api/recommendations/me/progression?currentScore=... and returns
 * the deterministic ReadinessProgression payload. The currentScore is taken
 * from the existing personalized recommendations payload to avoid a
 * second round-trip.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { ReadinessProgression } from '@aip/types';
import { queryKeys } from './queryKeys';

export function useReadinessProgression(currentScore: number) {
  return useQuery({
    queryKey: queryKeys.careerProgression(currentScore),
    queryFn: () =>
      apiGet<ReadinessProgression>(
        `/recommendations/me/progression?currentScore=${currentScore}`,
      ),
    enabled: typeof currentScore === 'number' && Number.isFinite(currentScore),
    staleTime: 10 * 60 * 1000,
  });
}
