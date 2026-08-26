import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiDelete } from '@/lib/api';
import { queryKeys } from './queryKeys';

export function useDeleteResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiDelete<void>('/students/me/resume'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studentResume() });
      toast.success('Resume deleted.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to delete resume.');
    },
  });
}
