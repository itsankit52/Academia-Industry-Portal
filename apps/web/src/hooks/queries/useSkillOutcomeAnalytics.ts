/**
 * Phase 10 — Skill outcome analytics hook.
 *
 * Calls GET /api/v1/institution-analytics/skill-outcomes and returns the
 * SkillOutcomeAnalytics payload. The institution is resolved server-side.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { SkillOutcomeAnalytics } from '@aip/types';

export function useSkillOutcomeAnalytics(institutionId?: string) {
  const query = institutionId
    ? `?institutionId=${encodeURIComponent(institutionId)}`
    : '';
  return useQuery({
    queryKey: queryKeys.placement.skillOutcomes(institutionId),
    queryFn: () =>
      apiGet<SkillOutcomeAnalytics>(`/institution-analytics/skill-outcomes${query}`),
    staleTime: 10 * 60 * 1000, // skill outcomes are stable
  });
}
