/**
 * Phase 10 — Placement outcomes hook.
 *
 * Calls GET /api/v1/placement-outcomes/me and returns the PlacementOutcomes
 * payload. The student is resolved server-side; the client never sends a student id.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { PlacementOutcomes } from '@aip/types';

export function usePlacementOutcomes() {
  return useQuery({
    queryKey: queryKeys.placement.outcomes(),
    queryFn: () => apiGet<PlacementOutcomes>('/placement-outcomes/me'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
