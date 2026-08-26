import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import { queryKeys } from './queryKeys';

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiPost<void>('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studentNotifications() });
      toast.success('All notifications marked as read.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to mark notifications.');
    },
  });
}
