import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import { queryKeys } from './queryKeys';

export interface ResumeSkillResult {
  added: Array<{ id: string; skill: { name: string } }>;
  skipped: string[];
  notFound: string[];
}

export interface AddSkillsFromResumeInput {
  skills: string[];
}

/**
 * Adds skills from a resume extraction to the student's skill profile.
 *
 * Calls POST /skills/me/skills-from-resume which:
 * - Looks each skill name up in the skills catalogue (case-insensitive)
 * - Creates a StudentSkill at BEGINNER level for each match
 * - Skips skills the student has already added
 * - Returns names not found in the catalogue for manual suggestion
 */
export function useAddSkillsFromResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddSkillsFromResumeInput) =>
      apiPost<ResumeSkillResult>('/skills/me/skills-from-resume', data),
    onSuccess: (result) => {
      // Invalidate all dependent queries so the skill profile and lists stay in sync.
      queryClient.invalidateQueries({ queryKey: queryKeys.studentSkills() });
      queryClient.invalidateQueries({ queryKey: ['skillProfile'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.studentDashboard() });

      const added = result.added?.length ?? 0;
      const skipped = result.skipped?.length ?? 0;
      const notFound = result.notFound?.length ?? 0;

      if (added > 0) {
        toast.success(`${added} skill${added === 1 ? '' : 's'} added to your profile.`);
      }
      if (skipped > 0) {
        toast.info(`${skipped} skill${skipped === 1 ? ' was' : 's were'} already in your profile.`);
      }
      if (notFound > 0) {
        toast.warning(
          `${notFound} skill${notFound === 1 ? ' was' : 's were'} not found in the catalogue. Use the Add Skill form to suggest them.`,
          { duration: 5000 },
        );
      }
      if (added === 0 && skipped === 0 && notFound === 0) {
        toast.info('No skills to add.');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to add skills from resume.');
    },
  });
}
