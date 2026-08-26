import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { StudentSkill } from '@aip/types';
import { queryKeys } from './queryKeys';

export function useStudentSkills() {
  return useQuery({
    queryKey: queryKeys.studentSkills(),
    queryFn: () => apiGet<StudentSkill[]>('/students/me/skills'),
  });
}
