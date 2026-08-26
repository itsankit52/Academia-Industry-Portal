import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiPut } from '@/lib/api';
import type { StudentProfile } from '@aip/types';
import type { UpdateStudentProfileInput } from '@aip/validation';
import { queryKeys } from './queryKeys';

export function useUpdateStudentProfile() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: UpdateStudentProfileInput) =>
      apiPut<StudentProfile>('/students/me/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studentProfile() });
      toast.success('Profile updated successfully.');
      navigate('/student/profile');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update profile.');
    },
  });
}
