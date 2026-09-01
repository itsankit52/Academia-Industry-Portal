import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiDelete } from '@/lib/api';
import { queryKeys } from './queryKeys';

export function useDeleteStudentProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/student-projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studentProjects() });
      toast.success('Project deleted.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to delete project.');
    },
  });
}
