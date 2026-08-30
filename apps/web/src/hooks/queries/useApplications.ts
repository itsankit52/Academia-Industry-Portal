import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Paginated, Application } from '@aip/types';
import { queryKeys } from './queryKeys';

export interface ApplicationFilters {
  status?: string;
  opportunityType?: string;
  page?: number;
  pageSize?: number;
}

export function useApplications(filters: ApplicationFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.opportunityType) params.set('opportunityType', filters.opportunityType);
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 20));

  return useQuery({
    queryKey: queryKeys.studentApplications(filters),
    queryFn: () => apiGet<Paginated<Application>>(`/applications?${params.toString()}`),
  });
}
