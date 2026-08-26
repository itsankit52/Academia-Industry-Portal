import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import type { Assessment } from '@aip/types';
import type { ApiClientError } from '@/lib/ApiClientError';
import { queryKeys } from './queryKeys';

interface GeneratePayload {
  questionCount?: number;
  durationMinutes?: number;
  skillIds?: string[];
}

export function useGenerateAssessment() {
  const qc = useQueryClient();
  return useMutation<Assessment, ApiClientError, GeneratePayload>({
    mutationFn: (body) => apiPost<Assessment>('/assessments/me/generate', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.student.assessments.all });
      void qc.invalidateQueries({ queryKey: queryKeys.student.assessments.summary });
      void qc.invalidateQueries({ queryKey: queryKeys.student.dashboard });
    },
  });
}
