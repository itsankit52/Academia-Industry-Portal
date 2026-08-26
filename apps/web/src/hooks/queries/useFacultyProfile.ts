import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPut } from '@/lib/api';
import type { FacultyProfile } from '@aip/types';
import type { UpdateFacultyProfileInput } from '@aip/validation';
import { queryKeys } from './queryKeys';

export function useFacultyProfile() {
  return useQuery({
    queryKey: queryKeys.faculty.profile(),
    queryFn: () => apiGet<FacultyProfile>('/faculty/me/profile'),
  });
}

export function useUpdateFacultyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateFacultyProfileInput) =>
      apiPut<FacultyProfile>('/faculty/me/profile', data),
    onSuccess: () => {
      toast.success('Profile updated.');
      qc.invalidateQueries({ queryKey: queryKeys.faculty.profile() });
      qc.invalidateQueries({ queryKey: queryKeys.faculty.dashboard() });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update profile.'),
  });
}
