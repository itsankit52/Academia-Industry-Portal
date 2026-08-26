import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPatch, apiDelete } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Internship, Paginated } from '@aip/types';

export interface AdminInternshipsFilters {
  status?: string;
  company?: string;
  q?: string;
}

export function useAdminInternships(filters?: AdminInternshipsFilters) {
  return useQuery({
    queryKey: queryKeys.admin.internships(filters),
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
      return apiGet<Paginated<Internship>>(`/internships${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useAdminForceCloseInternship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<Internship>(`/admin/internships/${id}/force-close`),
    onSuccess: () => {
      toast.success('Internship closed.');
      qc.invalidateQueries({ queryKey: ['admin', 'internships'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAdminDeleteInternship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/internships/${id}`),
    onSuccess: () => {
      toast.success('Internship deleted.');
      qc.invalidateQueries({ queryKey: ['admin', 'internships'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
