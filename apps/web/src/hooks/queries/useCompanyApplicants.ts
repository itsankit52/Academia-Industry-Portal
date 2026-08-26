import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPatch } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Application, Paginated } from '@aip/types';
import type { ApplicationStatus } from '@aip/config';

export interface ApplicantsFilters {
  status?: string;
  opportunityId?: string;
  minMatchScore?: number;
}

export function useCompanyApplicants(filters?: ApplicantsFilters) {
  return useQuery({
    queryKey: queryKeys.company.applicants(filters),
    queryFn: () => {
      const params = new URLSearchParams({ scope: 'company' });
      if (filters?.status) params.set('status', filters.status);
      if (filters?.opportunityId) params.set('opportunityId', filters.opportunityId);
      if (filters?.minMatchScore != null) params.set('minMatchScore', String(filters.minMatchScore));
      return apiGet<Paginated<Application>>(`/applications?${params}`);
    },
  });
}

export interface CandidateDetails {
  application: Application;
  studentProfile: {
    fullName: string;
    email: string;
    college?: string;
    branch?: string;
    cgpa?: number;
    bio?: string;
    skills: { id: string; name: string; category: string; proficiency: string }[];
    projects: { title: string; description: string; techStack: string[]; link?: string }[];
    certifications: { title: string; issuer: string; issuedAt: string; credentialUrl?: string }[];
    experience: { title: string; organization: string; startDate: string; endDate?: string; description?: string }[];
    achievements: { title: string; description?: string; date?: string }[];
    resumeUrl?: string;
  };
  matchedSkills: string[];
  missingSkills: string[];
}

export function useCandidateDetails(applicationId: string) {
  return useQuery({
    queryKey: queryKeys.company.candidate(applicationId),
    queryFn: () => apiGet<CandidateDetails>(`/applications/${applicationId}/candidate`),
    enabled: !!applicationId,
  });
}

export function useUpdateApplicationStatus() {
  const qc = useQueryClient();
  return useMutation({
    // The route is `PATCH /applications/:id/status` — there is no
    // `PATCH /applications/:id` handler, so the missing segment fell through to the
    // 404 catch-all and every Shortlist/Reject click answered "Route not found".
    // `useWithdrawApplication` has always used the correct path.
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus }) =>
      apiPatch<Application>(`/applications/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Status updated.');
      // Invalidate by *prefix*. `queryKeys.company.applicants()` called with no
      // argument yields `['company','applicants',undefined]`, and react-query's
      // partial match compares that third element against the live key's filter
      // object — `undefined` matches neither `{}` nor `{status:'…'}`, so nothing
      // was refetched and the row kept its old status until a manual reload.
      qc.invalidateQueries({ queryKey: ['company', 'applicants'] });
      // The applicant detail page shows the same status and timeline from its own
      // query, and shortlists from the same mutation.
      qc.invalidateQueries({ queryKey: ['company', 'candidate'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
