import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import type { FacultyOpportunity, Paginated } from '@aip/types';
import type {
  CreateFacultyOpportunityInput,
  UpdateFacultyOpportunityInput,
} from '@aip/validation';
import { queryKeys } from './queryKeys';

export interface FacultyOpportunityFilters {
  q?: string;
  opportunityType?: string;
  status?: string;
  hostType?: string;
  mode?: string;
  page?: number;
  pageSize?: number;
}

function buildParams(filters: FacultyOpportunityFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.opportunityType) params.set('opportunityType', filters.opportunityType);
  if (filters.status) params.set('status', filters.status);
  if (filters.hostType) params.set('hostType', filters.hostType);
  if (filters.mode) params.set('mode', filters.mode);
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 12));
  return params.toString();
}

export function useFacultyOpportunities(filters: FacultyOpportunityFilters = {}) {
  return useQuery({
    queryKey: queryKeys.faculty.opportunities(filters),
    queryFn: () =>
      apiGet<Paginated<FacultyOpportunity>>(`/faculty-opportunities?${buildParams(filters)}`),
  });
}

export function useMyFacultyOpportunities(filters: FacultyOpportunityFilters = {}) {
  return useQuery({
    queryKey: queryKeys.company.facultyOpps(filters),
    queryFn: () =>
      apiGet<Paginated<FacultyOpportunity>>(`/faculty-opportunities/me?${buildParams(filters)}`),
  });
}

export function useFacultyOpportunity(id: string) {
  return useQuery({
    queryKey: queryKeys.faculty.opportunity(id),
    queryFn: () => apiGet<FacultyOpportunity>(`/faculty-opportunities/${id}`),
    enabled: !!id,
  });
}

export function useCreateFacultyOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFacultyOpportunityInput) =>
      apiPost<FacultyOpportunity>('/faculty-opportunities', data),
    onSuccess: () => {
      toast.success('Faculty opportunity created.');
      qc.invalidateQueries({ queryKey: ['company', 'faculty-opps'] });
      qc.invalidateQueries({ queryKey: ['faculty', 'opportunities'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateFacultyOpportunity(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateFacultyOpportunityInput) =>
      apiPut<FacultyOpportunity>(`/faculty-opportunities/${id}`, data),
    onSuccess: () => {
      toast.success('Faculty opportunity updated.');
      qc.invalidateQueries({ queryKey: ['company', 'faculty-opps'] });
      qc.invalidateQueries({ queryKey: queryKeys.faculty.opportunity(id) });
      qc.invalidateQueries({ queryKey: queryKeys.company.facultyOpp(id) });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePatchFacultyOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFacultyOpportunityInput }) =>
      apiPatch<FacultyOpportunity>(`/faculty-opportunities/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', 'faculty-opps'] });
      qc.invalidateQueries({ queryKey: ['faculty', 'opportunities'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCloseFacultyOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<FacultyOpportunity>(`/faculty-opportunities/${id}/close`),
    onSuccess: () => {
      toast.success('Opportunity closed.');
      qc.invalidateQueries({ queryKey: ['company', 'faculty-opps'] });
      qc.invalidateQueries({ queryKey: ['faculty', 'opportunities'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteFacultyOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/faculty-opportunities/${id}`),
    onSuccess: () => {
      toast.success('Opportunity deleted.');
      qc.invalidateQueries({ queryKey: ['company', 'faculty-opps'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
