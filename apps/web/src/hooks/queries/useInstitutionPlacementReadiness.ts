/**
 * Phase 10 — Institution placement readiness hook.
 *
 * Calls GET /api/v1/institution-analytics/placement-readiness and returns the
 * InstitutionPlacementReadiness payload. The institution is resolved
 * server-side; the client may pass an institutionId query param only when
 * authorised (ADMIN cross-institution).
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { InstitutionPlacementReadiness } from '@aip/types';

export function useInstitutionPlacementReadiness(institutionId?: string) {
  const query = institutionId
    ? `?institutionId=${encodeURIComponent(institutionId)}`
    : '';
  return useQuery({
    queryKey: queryKeys.placement.institutionReadiness(institutionId),
    queryFn: () =>
      apiGet<InstitutionPlacementReadiness>(`/institution-analytics/placement-readiness${query}`),
    staleTime: 5 * 60 * 1000,
  });
}
