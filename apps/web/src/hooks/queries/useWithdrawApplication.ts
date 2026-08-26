import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPatch } from '@/lib/api';
import { queryKeys } from './queryKeys';

export function useWithdrawApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiPatch<void>(`/applications/${id}/status`, { status: 'WITHDRAWN' }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studentApplication(id) });
      queryClient.invalidateQueries({ queryKey: ['student', 'applications'] });
      toast.success('Application withdrawn.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to withdraw application.');
    },
  });
}
