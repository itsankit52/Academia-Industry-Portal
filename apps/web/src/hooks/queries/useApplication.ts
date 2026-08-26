import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Application } from '@aip/types';
import { queryKeys } from './queryKeys';

export function useApplication(id: string) {
  return useQuery({
    queryKey: queryKeys.studentApplication(id),
    queryFn: () => apiGet<Application>(`/applications/${id}`),
    enabled: !!id,
  });
}
