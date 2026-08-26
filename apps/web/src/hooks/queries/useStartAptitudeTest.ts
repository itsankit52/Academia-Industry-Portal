import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import type { AptitudeTest } from '@aip/types';
import type { AptitudeCategory } from '@aip/config';
import type { ApiClientError } from '@/lib/ApiClientError';
import { queryKeys } from './queryKeys';

interface StartTestPayload {
  category: AptitudeCategory;
  questionCount?: number;
}

export function useStartAptitudeTest() {
  const qc = useQueryClient();
  return useMutation<AptitudeTest, ApiClientError, StartTestPayload>({
    mutationFn: (body) => apiPost<AptitudeTest>('/aptitude/tests', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.aptitude.all });
    },
  });
}
