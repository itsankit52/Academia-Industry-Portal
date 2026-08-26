import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost, apiDelete } from '@/lib/api';
import type { OpportunityType } from '@aip/config';
import { queryKeys } from './queryKeys';

export interface ToggleSavedInput {
  action: 'save' | 'unsave';
  opportunityType: OpportunityType;
  opportunityId: string;
}

export function useToggleSaved() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ action, opportunityType, opportunityId }: ToggleSavedInput) => {
      if (action === 'save') {
        return apiPost<void>('/students/me/saved', { opportunityType, opportunityId });
      }
      return apiDelete<void>(`/students/me/saved/${opportunityType}/${opportunityId}`);
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedOpportunities() });
      toast.success(action === 'save' ? 'Saved.' : 'Removed from saved.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update saved.');
    },
  });
}
