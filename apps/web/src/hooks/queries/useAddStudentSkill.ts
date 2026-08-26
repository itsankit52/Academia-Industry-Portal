import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import type { StudentSkill } from '@aip/types';
import type { Proficiency } from '@aip/config';
import { queryKeys } from './queryKeys';

export interface AddSkillInput {
  skillId: string;
  proficiency: Proficiency;
  yearsExperience?: number;
  evidenceUrl?: string;
}

export function useAddStudentSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddSkillInput) => apiPost<StudentSkill>('/students/me/skills', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studentSkills() });
      toast.success('Skill added.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to add skill.');
    },
  });
}
