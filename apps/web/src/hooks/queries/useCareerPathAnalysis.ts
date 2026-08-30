/**
 * Phase 9B — Career path / target-role analysis hook.
 *
 * Calls GET /api/recommendations/me/career-path/:type/:id and returns the
 * deterministic CareerPathAnalysis payload. Reuses the existing query-keys
 * convention (recommendations.*) and the existing apiGet helper.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { CareerPathAnalysis } from '@aip/types';
import type { OpportunityType } from '@aip/config';
import { queryKeys } from './queryKeys';

/**
 * Fetches the deterministic career-path analysis for a specific opportunity.
 * Returns the analysis when resolved; the caller's UI handles loading/error.
 */
export function useCareerPathAnalysis(type: OpportunityType, id: string) {
  return useQuery({
    queryKey: queryKeys.careerPath(type, id),
    queryFn: () => apiGet<CareerPathAnalysis>(`/recommendations/me/career-path/${type}/${id}`),
    enabled: Boolean(type && id),
    staleTime: 5 * 60 * 1000,
  });
}
