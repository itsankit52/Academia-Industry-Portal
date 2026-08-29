/**
 * Phase 4 — Full match analysis hook.
 *
 * Calls GET /recommendations/full-match/:type/:id which wraps the deterministic
 * `analyzeFullMatch` engine. Returns the complete multi-dimensional breakdown
 * (technical, proficiency, soft, career, industry demand, eligibility) so the
 * student UI can render per-opportunity match details including proficiency gaps.
 *
 * Reuses FullMatchResult types from @aip/types so no new type definitions are
 * needed in the web package.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { FullMatchResult } from '@aip/types';
import type { OpportunityType } from '@aip/config';
import { queryKeys } from './queryKeys';

/** Envelope returned by the API — extends FullMatchResult with routing metadata. */
export interface FullMatchAnalysis extends FullMatchResult {
  opportunityId: string;
  opportunityType: OpportunityType;
  opportunityTitle: string;
  studentId: string;
}

/**
 * Fetches the deterministic full-match analysis for a specific opportunity.
 * Returns null while loading, undefined on error (caller handles ErrorState).
 */
export function useFullMatch(type: OpportunityType, id: string) {
  return useQuery({
    queryKey: queryKeys.fullMatch(type, id),
    queryFn: () => apiGet<FullMatchAnalysis>(`/recommendations/full-match/${type}/${id}`),
    enabled: Boolean(type && id),
  });
}
