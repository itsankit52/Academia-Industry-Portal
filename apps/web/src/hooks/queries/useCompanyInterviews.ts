import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Interview, Paginated } from '@aip/types';
import type { CreateInterviewInput, UpdateInterviewInput } from '@aip/validation';

export function useCompanyInterviews(tab?: string) {
  return useQuery({
    queryKey: queryKeys.company.interviews({ tab }),
    queryFn: () => {
      const params = new URLSearchParams({ scope: 'company' });
      if (tab) params.set('tab', tab);
      return apiGet<Paginated<Interview>>(`/interviews?${params}`);
    },
  });
}

export function useCreateInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInterviewInput) => apiPost<Interview>('/interviews', data),
    onSuccess: () => {
      toast.success('Interview scheduled.');
      qc.invalidateQueries({ queryKey: queryKeys.company.interviews() });
      qc.invalidateQueries({ queryKey: queryKeys.company.applicants() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInterviewInput }) =>
      apiPatch<Interview>(`/interviews/${id}`, data),
    onSuccess: () => {
      toast.success('Interview updated.');
      qc.invalidateQueries({ queryKey: queryKeys.company.interviews() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<Interview>(`/interviews/${id}`, { status: 'CANCELLED' }),
    onSuccess: () => {
      toast.success('Interview cancelled.');
      qc.invalidateQueries({ queryKey: queryKeys.company.interviews() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
