import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPatch } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { CompanyProfile, Paginated } from '@aip/types';

export interface CompanyRow {
  id: string;
  userId: string;
  companyName: string;
  industry?: string;
  companySize?: string;
  location?: string;
  activeJobsCount: number;
  isVerified: boolean;
  isActive: boolean;
  logoUrl?: string;
  createdAt: string;
}

export interface AdminCompaniesFilters {
  industry?: string;
  verified?: string;
  q?: string;
}

export function useAdminCompanies(filters?: AdminCompaniesFilters) {
  return useQuery({
    queryKey: queryKeys.admin.companies(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.industry) params.set('industry', filters.industry);
      if (filters?.verified) params.set('verified', filters.verified);
      if (filters?.q) params.set('q', filters.q);
      const qs = params.toString();
      return apiGet<Paginated<CompanyRow>>(`/companies${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useAdminCompanyProfile(id: string) {
  return useQuery({
    queryKey: ['admin', 'company', id],
    queryFn: () => apiGet<CompanyProfile>(`/companies/${id}`),
    enabled: !!id,
  });
}

export function useVerifyCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<void>(`/admin/companies/${id}/verify`, {}),
    onSuccess: () => {
      toast.success('Company verified.');
      qc.invalidateQueries({ queryKey: ['admin', 'companies'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeactivateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiPatch<void>(`/admin/users/${id}`, { isActive }),
    onSuccess: () => {
      toast.success('Company status updated.');
      qc.invalidateQueries({ queryKey: ['admin', 'companies'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
