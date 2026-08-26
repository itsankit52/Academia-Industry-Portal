import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import type { AptitudeTestResult } from '@aip/types';
import type { ApiClientError } from '@/lib/ApiClientError';
import { queryKeys } from './queryKeys';

export function useSubmitAptitudeTest() {
  const qc = useQueryClient();
  return useMutation<AptitudeTestResult, ApiClientError, string>({
    mutationFn: (testId) => apiPost<AptitudeTestResult>(`/aptitude/tests/${testId}/submit`),
    onSuccess: (_data, testId) => {
      void qc.invalidateQueries({ queryKey: queryKeys.aptitude.test(testId) });
      void qc.invalidateQueries({ queryKey: queryKeys.aptitude.all });
    },
  });
}
