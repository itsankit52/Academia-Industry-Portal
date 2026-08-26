import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '@/lib/api';
import type { AptitudeQuestion } from '@aip/types';
import type { ApiClientError } from '@/lib/ApiClientError';
import type { AptitudeCategory } from '@aip/config';
import { queryKeys } from './queryKeys';

export interface UpdateAptitudeQuestionPayload {
  category?: AptitudeCategory;
  question?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  tags?: string[];
  status?: 'ACTIVE' | 'ARCHIVED';
}

interface Variables {
  id: string;
  patch: UpdateAptitudeQuestionPayload;
}

export function useUpdateAptitudeQuestion() {
  const qc = useQueryClient();
  return useMutation<AptitudeQuestion, ApiClientError, Variables>({
    mutationFn: ({ id, patch }) =>
      apiPatch<AptitudeQuestion>(`/admin/aptitude-questions/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.aptitude.all });
    },
  });
}
