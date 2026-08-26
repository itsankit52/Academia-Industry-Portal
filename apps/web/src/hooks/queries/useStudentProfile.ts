import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { StudentProfile } from '@aip/types';
import { queryKeys } from './queryKeys';

export function useStudentProfile() {
  return useQuery({
    queryKey: queryKeys.studentProfile(),
    queryFn: () => apiGet<StudentProfile>('/students/me/profile'),
  });
}
