import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Interview, Paginated } from '@aip/types';
import { queryKeys } from './queryKeys';

export type InterviewTab = 'upcoming' | 'past';

export function useInterviews(tab: InterviewTab = 'upcoming') {
  return useQuery({
    queryKey: queryKeys.studentInterviews(tab),
    queryFn: () => apiGet<Paginated<Interview>>(`/interviews?tab=${tab}`),
  });
}

/**
 * Single interview, for `/student/interviews/:id`.
 *
 * `GET /interviews/:id` already existed and already authorises the caller —
 * `assertInterviewAccess` compares the interview's application to the caller's
 * own `StudentProfile`, so a student reading someone else's interview gets a 403.
 * What was missing was any frontend that called it: the API writes the
 * notification deep link `/student/interviews/<id>`, and with no route of that
 * shape every "Interview scheduled" notification fell through to the catch-all
 * NotFound route, so the student could never reach the meeting link.
 */
export function useInterview(id: string) {
  return useQuery({
    queryKey: queryKeys.studentInterview(id),
    queryFn: () => apiGet<Interview>(`/interviews/${id}`),
    enabled: Boolean(id),
  });
}
