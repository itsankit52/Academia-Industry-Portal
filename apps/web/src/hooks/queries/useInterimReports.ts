import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import type { Paginated, InterimReport } from '@aip/types';
import { queryKeys } from './queryKeys';

export interface InterimReportsFilters {
  page?: number;
  pageSize?: number;
}

export function useInterimReports(appId: string, filters: InterimReportsFilters = {}) {
  const sp = new URLSearchParams();
  if (filters.page) sp.set('page', String(filters.page));
  if (filters.pageSize) sp.set('pageSize', String(filters.pageSize));
  const qs = sp.toString();
  return useQuery({
    queryKey: queryKeys.interim.forApp(appId, filters),
    queryFn: () =>
      apiGet<Paginated<InterimReport>>(
        `/applications/${appId}/interim-reports${qs ? `?${qs}` : ''}`,
      ),
    enabled: !!appId,
  });
}

export interface CreateInterimReportInput {
  weekNumber: number;
  periodStart?: string;
  periodEnd?: string;
  workDescription?: string;
  learnings?: string;
  challenges?: string;
  hoursSpent?: number;
}

export function useCreateInterimReport(appId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInterimReportInput) =>
      apiPost<InterimReport>(`/applications/${appId}/interim-reports`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interim', 'app', appId] });
      toast.success('Interim report submitted.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to submit report.'),
  });
}

export interface MentorFeedbackInput {
  mentorFeedback: string;
  mentorRating?: number;
}

export function useMentorFeedback(appId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string } & MentorFeedbackInput) =>
      apiPatch<InterimReport>(`/interim-reports/${input.id}/feedback`, {
        mentorFeedback: input.mentorFeedback,
        ...(typeof input.mentorRating === 'number' ? { mentorRating: input.mentorRating } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interim', 'app', appId] });
      toast.success('Feedback saved.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save feedback.'),
  });
}
