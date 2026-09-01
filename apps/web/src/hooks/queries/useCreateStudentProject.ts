import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { StudentProject } from './useStudentProjects';

export interface CreateProjectPayload {
  title: string;
  description: string;
  role?: string;
  technologies?: string[];
  links?: Array<{ label: string; url: string }>;
  completedAt?: string;
}

export function useCreateStudentProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) =>
      apiPost<StudentProject>('/student-projects', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studentProjects() });
      toast.success('Project added.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to add project.');
    },
  });
}
