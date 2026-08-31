import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPatch } from '@/lib/api';
import type { Application, Paginated } from '@aip/types';
import type { ApplicationStatus } from '@aip/config';
import { queryKeys } from './queryKeys';

export interface FacultyApplicationFilters {
  status?: string;
  opportunityType?: string;
  page?: number;
  pageSize?: number;
}

export function useFacultyApplications(filters: FacultyApplicationFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.opportunityType) params.set('opportunityType', filters.opportunityType);
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 20));

  return useQuery({
    queryKey: queryKeys.faculty.applications(filters),
    queryFn: () => apiGet<Paginated<Application>>(`/applications?${params.toString()}`),
  });
}

export function useFacultyApplication(id: string) {
  return useQuery({
    queryKey: queryKeys.faculty.application(id),
    queryFn: () => apiGet<Application>(`/applications/${id}`),
    enabled: !!id,
  });
}

export function useFacultyApplicationCounts() {
  return useQuery({
    queryKey: queryKeys.faculty.countByStatus(),
    queryFn: () => apiGet<Record<ApplicationStatus, number>>('/applications/me/count-by-status'),
  });
}

// ---------------------------------------------------------------------------
// Faculty: withdraw application
// ---------------------------------------------------------------------------

export function useWithdrawFacultyApplication(applicationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { reason?: string }) =>
      apiPatch<Application>(`/applications/${applicationId}/withdraw`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.faculty.applications() });
      queryClient.invalidateQueries({ queryKey: queryKeys.faculty.engagements() });
      toast.success('Application withdrawn successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to withdraw application.');
    },
  });
}

// ---------------------------------------------------------------------------
// Company: list applicants for a faculty opportunity
// ---------------------------------------------------------------------------

export interface OpportunityApplicant {
  applicationId: string;
  facultyProfileId: string;
  facultyName: string;
  facultyEmail: string;
  department?: string;
  designation?: string;
  qualifications: string[];
  researchInterests: string[];
  coverLetter?: string;
  status: string;
  appliedAt?: string;
  timeline: Array<{ status: string; at: string; note?: string }>;
}

export function useListOpportunityApplicants(
  opportunityId: string,
  filters: { page?: number; pageSize?: number } = {},
) {
  const params = new URLSearchParams();
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 20));

  return useQuery({
    queryKey: ['faculty-opportunity', opportunityId, 'applicants', filters] as const,
    queryFn: () =>
      apiGet<Paginated<OpportunityApplicant>>(
        `/faculty-opportunities/${opportunityId}/applicants?${params.toString()}`,
      ),
    enabled: !!opportunityId,
  });
}

export function useOpportunityApplicant(opportunityId: string, applicationId: string) {
  return useQuery({
    queryKey: ['faculty-opportunity', opportunityId, 'applicant', applicationId] as const,
    queryFn: () =>
      apiGet<OpportunityApplicant>(
        `/faculty-opportunities/${opportunityId}/applicants/${applicationId}`,
      ),
    enabled: !!opportunityId && !!applicationId,
  });
}
