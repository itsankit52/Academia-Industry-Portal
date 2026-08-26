import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Notification, Paginated } from '@aip/types';

export function useCompanyNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications('company'),
    queryFn: () => apiGet<Paginated<Notification>>('/notifications?scope=company'),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<Notification>(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications('company') });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<void>('/notifications/read-all', { scope: 'company' }),
    onSuccess: () => {
      toast.success('All notifications marked as read.');
      qc.invalidateQueries({ queryKey: queryKeys.notifications('company') });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
