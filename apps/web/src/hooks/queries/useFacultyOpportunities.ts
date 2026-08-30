import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import type { FacultyOpportunity, Paginated } from '@aip/types';
import type { CreateFacultyOpportunityInput, UpdateFacultyOpportunityInput } from '@aip/validation';
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
    // Company and institution use the same endpoint; keying under a single
    // shared root keeps the cache hot across role switches and makes
    // invalidation easier — every mutation that lists "my opps" can drop the
    // `['my-faculty-opps', ...]` branch in one call.
    queryKey: ['my-faculty-opps', filters],
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
    // Accept both input shapes — the form passes UpdateFacultyOpportunityInput (all
    // fields optional) and addStatus covers the required fields via the form's
    // own validation + buildPayload logic.
    mutationFn: (data: CreateFacultyOpportunityInput | UpdateFacultyOpportunityInput) =>
      apiPost<FacultyOpportunity>('/faculty-opportunities', data as CreateFacultyOpportunityInput),
    onSuccess: () => {
      toast.success('Faculty opportunity created.');
      qc.invalidateQueries({ queryKey: ['my-faculty-opps'] });
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
      qc.invalidateQueries({ queryKey: ['my-faculty-opps'] });
      qc.invalidateQueries({ queryKey: queryKeys.faculty.opportunity(id) });
      qc.invalidateQueries({ queryKey: queryKeys.company.facultyOpp(id) });
      qc.invalidateQueries({ queryKey: queryKeys.institution.facultyOpp(id) });
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
      qc.invalidateQueries({ queryKey: ['my-faculty-opps'] });
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
      qc.invalidateQueries({ queryKey: ['my-faculty-opps'] });
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
      qc.invalidateQueries({ queryKey: ['my-faculty-opps'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAdminFacultyOpportunities(filters: FacultyOpportunityFilters = {}) {
  return useQuery({
    queryKey: ['admin', 'faculty-opportunities', filters],
    queryFn: () =>
      apiGet<Paginated<FacultyOpportunity>>(`/faculty-opportunities/all?${buildParams(filters)}`),
  });
}
