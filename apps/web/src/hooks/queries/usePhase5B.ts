import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import type { Paginated } from '@aip/types';
import { queryKeys } from './queryKeys';

export interface MentorAssignment {
  userId: string;
  email: string;
  fullName: string;
  bio?: string;
  expertise: string[];
  yearsExperience?: number;
  availability?: string;
}

/* ============================================================
   Mentor management
   ============================================================ */

export function useApplicationMentor(appId: string) {
  return useQuery({
    queryKey: ['phase5b', 'mentor', appId],
    queryFn: async () => {
      try {
        return await apiGet<MentorAssignment | null>(
          `/applications/${appId}/mentor`,
        );
      } catch {
        return null;
      }
    },
    enabled: !!appId,
  });
}

export function useAssignMentor(appId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mentorUserId: string) =>
      apiPost(`/applications/${appId}/mentor`, { mentorUserId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phase5b', 'mentor', appId] });
      qc.invalidateQueries({ queryKey: queryKeys.studentApplication(appId) });
      qc.invalidateQueries({ queryKey: queryKeys.company.candidate(appId) });
      toast.success('Mentor assigned successfully.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to assign mentor.'),
  });
}

export function useRemoveMentor(appId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete(`/applications/${appId}/mentor`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phase5b', 'mentor', appId] });
      qc.invalidateQueries({ queryKey: queryKeys.studentApplication(appId) });
      qc.invalidateQueries({ queryKey: queryKeys.company.candidate(appId) });
      toast.success('Mentor removed.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to remove mentor.'),
  });
}

export function useAvailableMentors(search?: string) {
  return useQuery({
    queryKey: ['mentors', 'available', search ?? ''],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (search) sp.set('search', search);
      return apiGet<Paginated<{
        id: string;
        userId: string;
        fullName: string;
        expertise: string[];
        yearsExperience?: number;
        availability: string;
        activeCount: number;
      }>>(`/mentors?${sp.toString()}`);
    },
  });
}

/* ============================================================
   Internship completion
   ============================================================ */

export function useCompleteInternship(appId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { completionNotes?: string; rating?: number }) =>
      apiPatch(`/applications/${appId}/internship/complete`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.studentApplication(appId) });
      qc.invalidateQueries({ queryKey: queryKeys.company.candidate(appId) });
      qc.invalidateQueries({ queryKey: queryKeys.studentApplications() });
      qc.invalidateQueries({ queryKey: queryKeys.company.applicants() });
      toast.success('Internship completed.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to complete internship.'),
  });
}

/* ============================================================
   Active interns listing (company)
   ============================================================ */

export interface ActiveIntern {
  id: string;
  status: string;
  startDate?: string;
  expectedEndDate?: string;
  startedAt?: string;
  reportCount: number;
  opportunity: {
    id: string;
    title: string;
    durationMonths?: number;
    stipend?: number;
    currency?: string;
  };
  student: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  mentor: {
    userId: string;
    bio?: string;
    expertise: string[];
    yearsExperience?: number;
  } | null;
}

export function useActiveInterns(filters: { page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: ['phase5b', 'active-interns', filters],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (filters.page) sp.set('page', String(filters.page));
      if (filters.pageSize) sp.set('pageSize', String(filters.pageSize));
      return apiGet<Paginated<ActiveIntern>>(`/applications/company/active-interns?${sp.toString()}`);
    },
  });
}

/* ============================================================
   Mentor's assigned interns
   ============================================================ */

export interface AssignedIntern {
  id: string;
  status: string;
  startDate?: string;
  expectedEndDate?: string;
  startedAt?: string;
  completedAt?: string;
  reportCount: number;
  opportunity: {
    id: string;
    title: string;
    durationMonths?: number;
    company: string;
  };
  student: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export function useMentorAssignedInterns(filters: { page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: ['phase5b', 'mentor-assigned', filters],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (filters.page) sp.set('page', String(filters.page));
      if (filters.pageSize) sp.set('pageSize', String(filters.pageSize));
      return apiGet<Paginated<AssignedIntern>>(
        `/applications/mentor/assigned-interns?${sp.toString()}`,
      );
    },
  });
}
