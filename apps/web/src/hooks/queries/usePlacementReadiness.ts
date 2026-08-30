/**
 * Phase 10 — Placement readiness hook.
 *
 * Calls GET /api/v1/placement-readiness/me and returns the deterministic
 * PlacementReadiness payload. The student is resolved server-side;
 * the client never sends a student id.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { PlacementReadiness } from '@aip/types';

export function usePlacementReadiness() {
  return useQuery({
    queryKey: queryKeys.placement.readiness(),
    queryFn: () => apiGet<PlacementReadiness>('/placement-readiness/me'),
    staleTime: 5 * 60 * 1000, // 5 minutes — readiness is derived from existing data
  });
}
