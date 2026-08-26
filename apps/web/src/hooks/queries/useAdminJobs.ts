import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPatch, apiDelete } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Job, Paginated } from '@aip/types';

export interface AdminJobsFilters {
  status?: string;
  company?: string;
  q?: string;
}

export function useAdminJobs(filters?: AdminJobsFilters) {
  return useQuery({
    queryKey: queryKeys.admin.jobs(filters),
    queryFn: () => {
      // The API reads `companyId` and `search`; the old `company`/`q`/`scope`
      // names were silently ignored, so the console's filters did nothing.
      // Omitting `status` returns every status for an admin caller — the
      // endpoint reads the session cookie and widens the filter accordingly.
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.company) params.set('companyId', filters.company);
      if (filters?.q) params.set('search', filters.q);
      const qs = params.toString();
      return apiGet<Paginated<Job>>(`/jobs${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useAdminForceCloseJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<Job>(`/admin/jobs/${id}/force-close`),
    onSuccess: () => {
      toast.success('Job closed.');
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAdminDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/jobs/${id}`),
    onSuccess: () => {
      toast.success('Job deleted.');
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
