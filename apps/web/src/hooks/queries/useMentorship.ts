import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import type {
  Paginated,
  PublicMentor,
  MentorProfile,
  MentorshipRequest,
  MentorshipMessage,
} from '@aip/types';
import type { MentorshipStatus } from '@aip/config';
import { queryKeys } from './queryKeys';

export interface MentorFilters {
  page?: number;
  pageSize?: number;
  expertise?: string;
  availability?: string;
  search?: string;
}

function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function useMentors(filters: MentorFilters = {}) {
  const qs = toQuery(filters as Record<string, unknown>);
  return useQuery({
    queryKey: queryKeys.mentorship.mentors(filters),
    queryFn: () => apiGet<Paginated<PublicMentor>>(`/mentorship/mentors${qs}`),
  });
}

export function useMentor(userId: string) {
  return useQuery({
    queryKey: queryKeys.mentorship.mentor(userId),
    queryFn: () => apiGet<MentorProfile & { fullName: string; activeCount: number }>(
      `/mentorship/mentors/${userId}`,
    ),
    enabled: !!userId,
  });
}

export interface BecomeMentorInput {
  bio?: string;
  expertise?: string[];
  yearsExperience?: number;
  mentorshipCapacity?: number;
  availability?: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';
  linkedInUrl?: string;
  githubUrl?: string;
}

export function useBecomeMentor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BecomeMentorInput) => apiPost<MentorProfile>('/mentorship/mentors/me', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mentorship', 'mentors'] });
      toast.success('You are now available as a mentor.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to become a mentor.'),
  });
}

export function useUpdateMentorProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<BecomeMentorInput>) =>
      apiPatch<MentorProfile>('/mentorship/mentors/me', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mentorship'] });
      toast.success('Mentor profile updated.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update profile.'),
  });
}

export interface RequestMentorshipInput {
  mentorUserId: string;
  initialMessage: string;
  goals?: string;
}

export function useRequestMentorship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestMentorshipInput) =>
      apiPost<MentorshipRequest>('/mentorship/requests', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mentorship', 'requests'] });
      toast.success('Mentorship request sent.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to send request.'),
  });
}

export interface MyRequestFilters {
  page?: number;
  pageSize?: number;
  status?: MentorshipStatus;
}

export function useMyRequestsAsMentee(filters: MyRequestFilters = {}) {
  const qs = toQuery(filters as Record<string, unknown>);
  return useQuery({
    queryKey: queryKeys.mentorship.requestsAsMentee(filters),
    queryFn: () =>
      apiGet<Paginated<MentorshipRequest & { mentorName: string }>>(
        `/mentorship/requests/mine/as-mentee${qs}`,
      ),
  });
}

export function useMyRequestsAsMentor(filters: MyRequestFilters = {}) {
  const qs = toQuery(filters as Record<string, unknown>);
  return useQuery({
    queryKey: queryKeys.mentorship.requestsAsMentor(filters),
    queryFn: () =>
      apiGet<Paginated<MentorshipRequest & { menteeName: string }>>(
        `/mentorship/requests/mine/as-mentor${qs}`,
      ),
  });
}

export function useMentorshipRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.mentorship.request(id),
    queryFn: () =>
      apiGet<MentorshipRequest & { mentorName: string; menteeName: string }>(
        `/mentorship/requests/${id}`,
      ),
    enabled: !!id,
  });
}

export function useUpdateRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: MentorshipStatus }) =>
      apiPatch<MentorshipRequest>(`/mentorship/requests/${input.id}/status`, {
        status: input.status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mentorship'] });
      toast.success('Status updated.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update status.'),
  });
}

export interface MessagesFilters {
  page?: number;
  pageSize?: number;
}

export function useMessages(requestId: string, filters: MessagesFilters = {}) {
  const qs = toQuery(filters as Record<string, unknown>);
  return useQuery({
    queryKey: queryKeys.mentorship.messages(requestId, filters),
    queryFn: () =>
      apiGet<Paginated<MentorshipMessage>>(`/mentorship/requests/${requestId}/messages${qs}`),
    enabled: !!requestId,
  });
}

export function useSendMessage(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiPost<MentorshipMessage>(`/mentorship/requests/${requestId}/messages`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mentorship', 'messages', requestId] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to send message.'),
  });
}

export function useAdminAllMentorships(filters: MyRequestFilters = {}) {
  const qs = toQuery(filters as Record<string, unknown>);
  return useQuery({
    queryKey: queryKeys.mentorship.adminAll(filters),
    queryFn: () =>
      apiGet<Paginated<MentorshipRequest & { mentorName: string; menteeName: string }>>(
        `/mentorship/requests/admin/all${qs}`,
      ),
  });
}
