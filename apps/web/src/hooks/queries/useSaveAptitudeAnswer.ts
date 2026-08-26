import { useMutation } from '@tanstack/react-query';
import { apiPatch } from '@/lib/api';
import type { ApiClientError } from '@/lib/ApiClientError';

interface Payload {
  questionId: string;
  chosenIndex: number;
}

export function useSaveAptitudeAnswer(testId: string) {
  return useMutation<{ savedAt: string }, ApiClientError, Payload>({
    mutationFn: (body) => apiPatch<{ savedAt: string }>(`/aptitude/tests/${testId}/answers`, body),
  });
}
