import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import type { Application } from '@aip/types';
import type { OpportunityType } from '@aip/config';
import { queryKeys } from './queryKeys';

/**
 * Mirrors `createApplicationSchema`, which is `.strict()` — any extra key makes
 * the whole request fail validation with a 422. `resumeId` is optional: leaving
 * it out tells the API to attach the student's most recent upload.
 */
export interface ApplyInput {
  opportunityType: OpportunityType;
  opportunityId: string;
  coverLetter?: string;
  resumeId?: string;
}

export function useApplyToOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ApplyInput) => apiPost<Application>('/applications', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', 'applications'] });
      toast.success('Application submitted successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to apply.');
    },
  });
}
