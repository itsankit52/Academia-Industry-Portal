/**
 * Phase 10 — Institution interventions hook.
 *
 * Calls GET /api/v1/institution-analytics/interventions and returns the
 * InstitutionInterventions payload. The institution is resolved server-side.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { InstitutionInterventions } from '@aip/types';

export function useInstitutionInterventions(institutionId?: string) {
  const query = institutionId
    ? `?institutionId=${encodeURIComponent(institutionId)}`
    : '';
  return useQuery({
    queryKey: queryKeys.placement.institutionInterventions(institutionId),
    queryFn: () =>
      apiGet<InstitutionInterventions>(`/institution-analytics/interventions${query}`),
    staleTime: 2 * 60 * 1000, // interventions may change as students progress
  });
}
