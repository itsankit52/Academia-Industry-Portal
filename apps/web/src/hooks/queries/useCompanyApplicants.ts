import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPatch } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Application, Paginated, TimelineEntry } from '@aip/types';
import type {
  ApplicationStatus,
  OpportunityType,
  RecruitmentSource,
  VerificationStatus,
} from '@aip/config';

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
      if (typeof filters?.minMatchScore === 'number') {
        params.set('minMatchScore', String(filters.minMatchScore));
      }
      return apiGet<Paginated<Application>>(`/applications?${params}`);
    },
  });
}

/**
 * `GET /applications/:id/candidate` — mirrors `CandidateDetailsView` in
 * `apps/api/src/modules/applications/applications.service.ts`, which is what
 * `apps/api/src/__tests__/candidate-details.spec.ts` pins down. The candidate sits
 * under `student`, the skills are top level, and the match breakdown and resume
 * belong to `application`.
 */
export interface CandidateSkill {
  id: string;
  name: string;
  category: string;
  proficiency: string;
  yearsExperience?: number;
}

export interface CandidateDetails {
  id: string;
  student: {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    college?: string;
    degree?: string;
    branch?: string;
    cgpa?: number;
    gradYear?: number;
    bio?: string;
    projects: { title: string; description?: string; techStack: string[]; link?: string }[];
    certifications: { title: string; issuer: string; issuedAt?: string; credentialUrl?: string }[];
    experience: {
      title: string;
      organization: string;
      startDate: string;
      endDate?: string;
      description?: string;
    }[];
    achievements: { title: string; description?: string; date?: string }[];
    preferredRoles: string[];
    preferredLocations: string[];
  };
  skills: CandidateSkill[];
  opportunity: {
    id: string;
    title: string;
    type: OpportunityType;
    company: { id: string; name: string };
  };
  application: {
    id: string;
    status: ApplicationStatus;
    coverLetter?: string;
    matchScore?: number;
    matchedSkills: string[];
    missingSkills: string[];
    resume?: { url: string; mimeType: string };
    timeline: TimelineEntry[];
    createdAt: string;
    offerDetails?: {
      offeredSalary?: number;
      currency?: string;
      joiningDate?: string;
      offerTerms?: string;
    };
    offerExpiresAt?: string;
    offerLetter?: { id: string; filename: string; mimeType: string };
    offerRespondedAt?: string;
    withdrawalRequestedAt?: string;
    // Phase 7B
    recruitmentSource?: RecruitmentSource;
    placedAt?: string;
    placementCompletionNotes?: string;
    placementVerification?: {
      status: VerificationStatus;
      verifiedBy?: string;
      verifiedAt?: string;
      note?: string;
    };
  };
  aiNarrative?: string;
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

export function useStartInternship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPatch<Application>(`/applications/${id}/internship/start`, {}),
    onSuccess: () => {
      toast.success('Internship started.');
      qc.invalidateQueries({ queryKey: ['company', 'applicants'] });
      qc.invalidateQueries({ queryKey: ['company', 'candidate'] });
      qc.invalidateQueries({ queryKey: ['company', 'dashboard'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMarkInternshipOngoing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPatch<Application>(`/applications/${id}/internship/ongoing`, {}),
    onSuccess: () => {
      toast.success('Marked as ongoing.');
      qc.invalidateQueries({ queryKey: ['company', 'applicants'] });
      qc.invalidateQueries({ queryKey: ['company', 'candidate'] });
      qc.invalidateQueries({ queryKey: ['company', 'dashboard'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
