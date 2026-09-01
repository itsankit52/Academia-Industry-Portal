import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Institution, Paginated } from '@aip/types';

export interface AdminInstitutionsFilters {
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED' | '';
  search?: string;
}

export function useAdminInstitutions(filters?: AdminInstitutionsFilters) {
  return useQuery({
    queryKey: queryKeys.admin.institutions(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.verificationStatus) params.set('verificationStatus', filters.verificationStatus);
      if (filters?.search) params.set('search', filters.search);
      const qs = params.toString();
      return apiGet<Paginated<Institution>>(`/admin/institutions${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useVerifyInstitution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<void>(`/admin/institutions/${id}/verify`, {}),
    onSuccess: () => {
      toast.success('Institution verified.');
      qc.invalidateQueries({ queryKey: ['admin', 'institutions'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
