import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import type {
  Paginated,
  CollaborationEvent,
  EventRegistration,
  EventFeedbackSummary,
} from '@aip/types';
import type { CollabEventType, Role } from '@aip/config';
import { queryKeys } from './queryKeys';

export interface EventFilters {
  page?: number;
  pageSize?: number;
  eventType?: CollabEventType;
  status?: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
  hostType?: 'COMPANY' | 'INSTITUTION';
  mode?: 'ONLINE' | 'ONSITE' | 'HYBRID';
  since?: string;
  search?: string;
  mine?: boolean;
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

export function useEvents(filters: EventFilters = {}) {
  const qs = toQuery(filters as Record<string, unknown>);
  return useQuery({
    queryKey: queryKeys.events.list(filters),
    queryFn: () => apiGet<Paginated<CollaborationEvent>>(`/events${qs}`),
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: queryKeys.events.detail(id),
    queryFn: () => apiGet<CollaborationEvent>(`/events/${id}`),
    enabled: !!id,
  });
}

export interface CreateEventInput {
  title: string;
  description: string;
  eventType: CollabEventType;
  startAt: string;
  endAt?: string;
  location?: string;
  mode: 'ONLINE' | 'ONSITE' | 'HYBRID';
  meetingLink?: string;
  capacity?: number;
  registrationDeadline?: string;
  targetAudience?: Role[];
  tags?: string[];
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) => apiPost<CollaborationEvent>('/events', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', 'list'] });
      toast.success('Event created.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create event.'),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string } & Partial<CreateEventInput>) => {
      const { id, ...body } = input;
      return apiPatch<CollaborationEvent>(`/events/${id}`, body);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['events', 'list'] });
      qc.invalidateQueries({ queryKey: queryKeys.events.detail(variables.id) });
      toast.success('Event updated.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update event.'),
  });
}

export function usePublishEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<CollaborationEvent>(`/events/${id}/publish`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['events', 'list'] });
      qc.invalidateQueries({ queryKey: queryKeys.events.detail(id) });
      toast.success('Event published.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to publish event.'),
  });
}

export function useCancelEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<CollaborationEvent>(`/events/${id}/cancel`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['events', 'list'] });
      qc.invalidateQueries({ queryKey: queryKeys.events.detail(id) });
      toast.success('Event cancelled.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to cancel event.'),
  });
}

export function useRegisterForEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<EventRegistration>(`/events/${id}/register`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.events.detail(id) });
      qc.invalidateQueries({ queryKey: ['events', 'mine', 'registrations'] });
      qc.invalidateQueries({ queryKey: ['events', 'list'] });
      toast.success('Registered for event.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to register.'),
  });
}

export function useUnregisterFromEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/events/${id}/register`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.events.detail(id) });
      qc.invalidateQueries({ queryKey: ['events', 'mine', 'registrations'] });
      qc.invalidateQueries({ queryKey: ['events', 'list'] });
      toast.success('Unregistered.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to unregister.'),
  });
}

export interface MyRegistrationsFilters {
  page?: number;
  pageSize?: number;
}

export function useMyRegistrations(filters: MyRegistrationsFilters = {}) {
  const qs = toQuery(filters as Record<string, unknown>);
  return useQuery({
    queryKey: queryKeys.events.myRegistrations(filters),
    queryFn: () =>
      apiGet<
        Paginated<
          EventRegistration & {
            event: { id: string; title: string; startAt: string; mode: string; status: string; host: { id: string; name: string } } | null;
          }
        >
      >(`/events/mine/registrations${qs}`),
  });
}

export function useEventRegistrations(eventId: string, filters: MyRegistrationsFilters = {}) {
  const qs = toQuery(filters as Record<string, unknown>);
  return useQuery({
    queryKey: queryKeys.events.registrations(eventId, filters),
    queryFn: () =>
      apiGet<
        Paginated<
          EventRegistration & {
            user: { id: string; email: string; role: string } | null;
          }
        >
      >(`/events/${eventId}/registrations${qs}`),
    enabled: !!eventId,
  });
}

export function useMarkAttended(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attendeeUserId: string) =>
      apiPost<EventRegistration>(`/events/${eventId}/attendance`, { attendeeUserId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events.registrations(eventId) });
      toast.success('Attendance marked.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to mark attendance.'),
  });
}

// Phase 8 — Event feedback
export interface SubmitFeedbackInput {
  rating: number;
  comment?: string;
}

export function useSubmitEventFeedback(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitFeedbackInput) =>
      apiPost<EventRegistration>(`/events/${eventId}/feedback`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events.feedbackSummary(eventId) });
      toast.success('Feedback submitted. Thank you!');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to submit feedback.'),
  });
}

export function useEventFeedbackSummary(eventId: string) {
  return useQuery({
    queryKey: queryKeys.events.feedbackSummary(eventId),
    queryFn: () => apiGet<EventFeedbackSummary>(`/events/${eventId}/feedback/summary`),
    enabled: !!eventId,
  });
}
