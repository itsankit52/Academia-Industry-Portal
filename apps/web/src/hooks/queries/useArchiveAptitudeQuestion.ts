import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import type { ApiClientError } from '@/lib/ApiClientError';
import { queryKeys } from './queryKeys';

export function useArchiveAptitudeQuestion() {
  const qc = useQueryClient();
  return useMutation<void, ApiClientError, string>({
    mutationFn: (id) => apiPost<void>(`/admin/aptitude-questions/${id}/archive`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.aptitude.all });
    },
  });
}
