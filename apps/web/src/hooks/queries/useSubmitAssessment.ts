import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import type { Assessment } from '@aip/types';
import type { ApiClientError } from '@/lib/ApiClientError';
import { queryKeys } from './queryKeys';

export function useSubmitAssessment() {
  const qc = useQueryClient();
  return useMutation<Assessment, ApiClientError, string>({
    mutationFn: (id) => apiPost<Assessment>(`/assessments/${id}/submit`, {}),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: queryKeys.student.assessments.all });
      void qc.invalidateQueries({ queryKey: queryKeys.student.assessments.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.student.assessments.latest });
      void qc.invalidateQueries({ queryKey: queryKeys.student.assessments.summary });
      void qc.invalidateQueries({ queryKey: queryKeys.student.dashboard });
    },
  });
}
