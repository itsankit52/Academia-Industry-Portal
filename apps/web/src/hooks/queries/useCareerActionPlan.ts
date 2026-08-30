/**
 * Phase 9B — Career action plan hook.
 *
 * Calls GET /api/recommendations/me/action-plan[?opportunityId=...&opportunityType=...]
 * and returns the deterministic CareerActionPlan payload.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { CareerActionPlan } from '@aip/types';
import type { OpportunityType } from '@aip/config';
import { queryKeys } from './queryKeys';

export interface ActionPlanParams {
  opportunityId?: string;
  opportunityType?: OpportunityType;
}

export function useCareerActionPlan(params: ActionPlanParams = {}) {
  const search = new URLSearchParams();
  if (params.opportunityId) search.set('opportunityId', params.opportunityId);
  if (params.opportunityType) search.set('opportunityType', params.opportunityType);
  const qs = search.toString();

  return useQuery({
    queryKey: queryKeys.careerActionPlan(params),
    queryFn: () =>
      apiGet<CareerActionPlan>(`/recommendations/me/action-plan${qs ? `?${qs}` : ''}`),
    staleTime: 5 * 60 * 1000,
  });
}
