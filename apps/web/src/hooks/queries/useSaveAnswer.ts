import { useMutation } from '@tanstack/react-query';
import { apiPatch } from '@/lib/api';
import type { ApiClientError } from '@/lib/ApiClientError';

interface SaveAnswerPayload {
  questionId: string;
  text: string;
}

export function useSaveAnswer(assessmentId: string) {
  return useMutation<{ updatedAt: string }, ApiClientError, SaveAnswerPayload>({
    mutationFn: (body) => apiPatch<{ updatedAt: string }>(`/assessments/${assessmentId}/answers`, body),
  });
}
