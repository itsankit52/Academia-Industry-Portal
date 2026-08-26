import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Internship, Paginated } from '@aip/types';
import type { CreateInternshipInput, UpdateInternshipInput } from '@aip/validation';

export interface CompanyInternshipsFilters {
  status?: string;
}

export function useCompanyInternships(filters?: CompanyInternshipsFilters) {
  return useQuery({
    queryKey: queryKeys.company.internships(filters),
    queryFn: () => {
      const params = new URLSearchParams(filters?.status ? { status: filters.status } : {});
      const qs = params.toString();
      return apiGet<Paginated<Internship>>(`/internships/me/managed${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useCompanyInternship(id: string) {
  return useQuery({
    queryKey: ['internship', id],
    queryFn: () => apiGet<Internship>(`/internships/${id}`),
    enabled: !!id,
  });
}

export function useCreateInternship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInternshipInput) => apiPost<Internship>('/internships', data),
    onSuccess: () => {
      toast.success('Internship created.');
      qc.invalidateQueries({ queryKey: queryKeys.company.internships() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateInternship(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateInternshipInput) => apiPut<Internship>(`/internships/${id}`, data),
    onSuccess: () => {
      toast.success('Internship updated.');
      qc.invalidateQueries({ queryKey: queryKeys.company.internships() });
      qc.invalidateQueries({ queryKey: ['internship', id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePatchInternship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInternshipInput }) =>
      apiPatch<Internship>(`/internships/${id}`, data),
    onSuccess: () => {
      toast.success('Internship updated.');
      qc.invalidateQueries({ queryKey: queryKeys.company.internships() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteInternship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/internships/${id}`),
    onSuccess: () => {
      toast.success('Internship deleted.');
      qc.invalidateQueries({ queryKey: queryKeys.company.internships() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
