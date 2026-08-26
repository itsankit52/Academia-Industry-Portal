import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import type { AptitudeQuestion } from '@aip/types';
import type { ApiClientError } from '@/lib/ApiClientError';
import type { AptitudeCategory } from '@aip/config';
import { queryKeys } from './queryKeys';

export interface CreateAptitudeQuestionPayload {
  category: AptitudeCategory;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  tags?: string[];
}

export function useCreateAptitudeQuestion() {
  const qc = useQueryClient();
  return useMutation<AptitudeQuestion, ApiClientError, CreateAptitudeQuestionPayload>({
    mutationFn: (body) => apiPost<AptitudeQuestion>('/admin/aptitude-questions', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.aptitude.all });
    },
  });
}
