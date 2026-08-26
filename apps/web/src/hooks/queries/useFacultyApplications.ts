import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Application, Paginated } from '@aip/types';
import type { ApplicationStatus } from '@aip/config';
import { queryKeys } from './queryKeys';

export interface FacultyApplicationFilters {
  status?: string;
  opportunityType?: string;
  page?: number;
  pageSize?: number;
}

export function useFacultyApplications(filters: FacultyApplicationFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.opportunityType) params.set('opportunityType', filters.opportunityType);
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 20));

  return useQuery({
    queryKey: queryKeys.faculty.applications(filters),
    queryFn: () => apiGet<Paginated<Application>>(`/applications?${params.toString()}`),
  });
}

export function useFacultyApplication(id: string) {
  return useQuery({
    queryKey: queryKeys.faculty.application(id),
    queryFn: () => apiGet<Application>(`/applications/${id}`),
    enabled: !!id,
  });
}

export function useFacultyApplicationCounts() {
  return useQuery({
    queryKey: queryKeys.faculty.countByStatus(),
    queryFn: () =>
      apiGet<Record<ApplicationStatus, number>>('/applications/me/count-by-status'),
  });
}
