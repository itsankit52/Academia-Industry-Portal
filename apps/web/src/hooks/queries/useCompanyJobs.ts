import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Job, Paginated } from '@aip/types';
import type { CreateJobInput, UpdateJobInput } from '@aip/validation';

export interface CompanyJobsFilters {
  status?: string;
}

export function useCompanyJobs(filters?: CompanyJobsFilters) {
  return useQuery({
    queryKey: queryKeys.company.jobs(filters),
    queryFn: () => {
      const params = new URLSearchParams(filters?.status ? { status: filters.status } : {});
      const qs = params.toString();
      return apiGet<Paginated<Job>>(`/jobs/me/managed${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useCompanyJob(id: string) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => apiGet<Job>(`/jobs/${id}`),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateJobInput) => apiPost<Job>('/jobs', data),
    onSuccess: () => {
      toast.success('Job created.');
      qc.invalidateQueries({ queryKey: queryKeys.company.jobs() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateJobInput) => apiPut<Job>(`/jobs/${id}`, data),
    onSuccess: () => {
      toast.success('Job updated.');
      qc.invalidateQueries({ queryKey: queryKeys.company.jobs() });
      qc.invalidateQueries({ queryKey: ['job', id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePatchJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateJobInput }) =>
      apiPatch<Job>(`/jobs/${id}`, data),
    onSuccess: () => {
      toast.success('Job updated.');
      qc.invalidateQueries({ queryKey: queryKeys.company.jobs() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/jobs/${id}`),
    onSuccess: () => {
      toast.success('Job deleted.');
      qc.invalidateQueries({ queryKey: queryKeys.company.jobs() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
