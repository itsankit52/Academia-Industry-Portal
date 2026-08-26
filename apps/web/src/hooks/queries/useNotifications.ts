import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Notification, Paginated } from '@aip/types';
import { queryKeys } from './queryKeys';

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.studentNotifications(),
    queryFn: () => apiGet<Paginated<Notification>>('/notifications'),
  });
}
