import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPut, apiPost } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { CompanyProfile } from '@aip/types';
import type { UpdateCompanyProfileInput } from '@aip/validation';

export function useCompanyProfile() {
  return useQuery({
    queryKey: queryKeys.company.profile(),
    queryFn: () => apiGet<CompanyProfile>('/companies/me/profile'),
  });
}

export function useUpdateCompanyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateCompanyProfileInput) =>
      apiPut<CompanyProfile>('/companies/me/profile', data),
    onSuccess: () => {
      toast.success('Profile updated.');
      qc.invalidateQueries({ queryKey: queryKeys.company.profile() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('logo', file);
      return apiPost<{ logoUrl: string }>('/companies/me/logo', fd);
    },
    onSuccess: () => {
      toast.success('Logo uploaded.');
      qc.invalidateQueries({ queryKey: queryKeys.company.profile() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
