import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Application, Paginated } from '@aip/types';

export interface AdminApplicationsFilters {
  status?: string;
  type?: string;
  company?: string;
  q?: string;
}

export function useAdminApplications(filters?: AdminApplicationsFilters) {
  return useQuery({
    queryKey: queryKeys.admin.applications(filters),
    queryFn: () => {
      const params = new URLSearchParams({ scope: 'admin' });
      if (filters?.status) params.set('status', filters.status);
      if (filters?.type) params.set('type', filters.type);
      if (filters?.company) params.set('company', filters.company);
      if (filters?.q) params.set('q', filters.q);
      return apiGet<Paginated<Application>>(`/applications?${params}`);
    },
  });
}
