import { useMutation, useQuery } from '@tanstack/react-query';
import { apiGet, apiPatch } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Paginated } from '@aip/types';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FacultyEngagement {
  id: string;
  applicationId: string;
  facultyOpportunityId: string;
  facultyOpportunityTitle: string;
  institutionName: string;
  facultyName: string;
  status: string;
  startDate?: string;
  endDate?: string;
  deliverables?: string[];
  outcome?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EngagementFilters {
  tab?: 'ACTIVE' | 'COMPLETED' | 'ALL';
  page?: number;
  pageSize?: number;
}

export interface MatchScore {
  overallScore: number;
  skillMatchScore: number;
  experienceMatchScore: number;
  recommendationLevel: 'STRONG' | 'MODERATE' | 'WEAK';
  matchedSkills: string[];
  missingSkills: string[];
  reasoning: string;
}

// ---------------------------------------------------------------------------
// useFacultyEngagements
// ---------------------------------------------------------------------------

export function useFacultyEngagements(filters: EngagementFilters = {}) {
  const params = new URLSearchParams();
  if (filters.tab) params.set('tab', filters.tab);
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 20));

  return useQuery({
    queryKey: queryKeys.faculty.engagements(filters.tab),
    queryFn: () =>
      apiGet<Paginated<FacultyEngagement>>(`/applications/engagements?${params.toString()}`),
  });
}

// ---------------------------------------------------------------------------
// useMatchScore
// ---------------------------------------------------------------------------

export function useMatchScore(opportunityId: string) {
  return useQuery({
    queryKey: ['faculty', 'match-score', opportunityId] as const,
    queryFn: () => apiGet<MatchScore>(`/faculty-opportunities/${opportunityId}/match-score`),
    enabled: !!opportunityId,
  });
}

// ---------------------------------------------------------------------------
// useCompleteEngagement
// ---------------------------------------------------------------------------

export function useCompleteEngagement(engagementId: string) {
  return useMutation({
    mutationFn: (payload: { outcome?: string }) =>
      apiPatch<FacultyEngagement>(`/applications/${engagementId}/engagement/complete`, payload),
    onError: () => {
      toast.error('Failed to complete engagement. Please try again.');
    },
  });
}
