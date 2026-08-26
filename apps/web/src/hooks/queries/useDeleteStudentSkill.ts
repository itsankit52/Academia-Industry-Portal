import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiDelete } from '@/lib/api';
import { queryKeys } from './queryKeys';

export function useDeleteStudentSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/students/me/skills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studentSkills() });
      toast.success('Skill removed.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to remove skill.');
    },
  });
}
