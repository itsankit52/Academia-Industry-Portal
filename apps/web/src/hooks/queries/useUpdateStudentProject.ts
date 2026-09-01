import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPatch } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { StudentProject } from './useStudentProjects';

export interface UpdateProjectPayload {
  title?: string;
  description?: string;
  role?: string;
  technologies?: string[];
  links?: Array<{ label: string; url: string }>;
  completedAt?: string | null;
  isPublic?: boolean;
}

export function useUpdateStudentProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProjectPayload }) =>
      apiPatch<StudentProject>(`/student-projects/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studentProjects() });
      toast.success('Project updated.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update project.');
    },
  });
}
