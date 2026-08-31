/**
 * Phase 15B — Student Opportunity Discovery Hooks
 *
 * Provides student-facing hooks for browsing, searching, and applying to
 * faculty/institution opportunities at /student-faculty-opportunities.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import type { Paginated } from '@aip/types';

// ---------------------------------------------------------------------------
// Types — mirror StudentOpportunityView from the service
// ---------------------------------------------------------------------------

export interface StudentOpportunity {
  id: string;
  title: string;
  description: string;
  opportunityType: string;
  hostType: 'COMPANY' | 'INSTITUTION';
  host: { id: string; name: string; logoUrl?: string };
  requiredExpertise: string[];
  preferredQualifications: string[];
  durationWeeks?: number;
  location: string;
  mode: string;
  applicationDeadline: string;
  openings: number;
  targetRoles: string[];
  status: string;
  postedBy: string;
  hasApplied: boolean;
  applicationStatus?: string;
  matchScore?: number;
  createdAt: string;
}

export interface StudentApplication {
  id: string;
  status: string;
  matchScore?: number;
  coverLetter?: string;
  timeline: Array<{ status: string; at: string; note?: string }>;
  appliedAt: string;
  opportunity: {
    id: string;
    title: string;
    type: string;
    hostType: 'COMPANY' | 'INSTITUTION';
    hostName: string;
    applicationDeadline: string;
  } | null;
}

export interface StudentOpportunityFilters {
  q?: string;
  opportunityType?: string;
  hostType?: 'COMPANY' | 'INSTITUTION';
  mode?: string;
  requiredExpertise?: string[];
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

function buildParams(filters: StudentOpportunityFilters): string {
  const sp = new URLSearchParams();
  if (filters.q) sp.set('q', filters.q);
  if (filters.opportunityType) sp.set('opportunityType', filters.opportunityType);
  if (filters.hostType) sp.set('hostType', filters.hostType);
  if (filters.mode) sp.set('mode', filters.mode);
  if (filters.requiredExpertise?.length) {
    filters.requiredExpertise.forEach((e) => sp.append('requiredExpertise', e));
  }
  sp.set('page', String(filters.page ?? 1));
  sp.set('pageSize', String(filters.pageSize ?? 12));
  return sp.toString();
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useStudentFacultyOpportunities(filters: StudentOpportunityFilters = {}) {
  return useQuery({
    queryKey: ['student-faculty-opportunities', filters],
    queryFn: () =>
      apiGet<Paginated<StudentOpportunity>>(
        `/student-faculty-opportunities?${buildParams(filters)}`,
      ),
  });
}

export function useStudentFacultyOpportunity(id: string) {
  return useQuery({
    queryKey: ['student-faculty-opportunity', id],
    queryFn: () => apiGet<StudentOpportunity>(`/student-faculty-opportunities/${id}`),
    enabled: !!id,
  });
}

export function useStudentFacultyApplications(filters: { page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: ['student-faculty-applications', filters],
    queryFn: () =>
      apiGet<Paginated<StudentApplication>>(
        `/student-faculty-opportunities/-/my-applications?page=${filters.page ?? 1}&pageSize=${filters.pageSize ?? 10}`,
      ),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useApplyToFacultyOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { opportunityId: string; coverLetter?: string }) =>
      apiPost<{ id: string; status: string; applicationId: string }>(
        `/student-faculty-opportunities/${data.opportunityId}/apply`,
        { coverLetter: data.coverLetter },
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['student-faculty-opportunities'] });
      qc.invalidateQueries({ queryKey: ['student-faculty-opportunity', vars.opportunityId] });
      qc.invalidateQueries({ queryKey: ['student-faculty-applications'] });
      toast.success('Application submitted successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to apply.');
    },
  });
}

export function useWithdrawFacultyApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opportunityId: string) =>
      apiPost<{ id: string; status: string }>(
        `/student-faculty-opportunities/${opportunityId}/withdraw`,
        {},
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['student-faculty-opportunities'] });
      qc.invalidateQueries({ queryKey: ['student-faculty-opportunity', vars] });
      qc.invalidateQueries({ queryKey: ['student-faculty-applications'] });
      toast.success('Application withdrawn.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to withdraw application.');
    },
  });
}
