import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { AuditLog, Paginated } from '@aip/types';

export interface AuditLogsFilters {
  actor?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  page?: number;
}

export function useAuditLogs(filters?: AuditLogsFilters) {
  return useQuery({
    queryKey: queryKeys.admin.auditLogs(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.actor) params.set('actor', filters.actor);
      if (filters?.action) params.set('action', filters.action);
      if (filters?.entity) params.set('entity', filters.entity);
      if (filters?.from) params.set('from', filters.from);
      if (filters?.to) params.set('to', filters.to);
      if (filters?.page) params.set('page', String(filters.page));
      const qs = params.toString();
      return apiGet<Paginated<AuditLog>>(`/audit-logs${qs ? `?${qs}` : ''}`);
    },
  });
}
