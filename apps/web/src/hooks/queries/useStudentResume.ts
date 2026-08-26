import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { ApiClientError } from '@/lib/ApiClientError';
import type { Resume } from '@aip/types';
import { queryKeys } from './queryKeys';

export function useStudentResume() {
  return useQuery({
    queryKey: queryKeys.studentResume(),
    queryFn: async () => {
      try {
        return await apiGet<Resume>('/students/me/resume');
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) return null;
        throw err;
      }
    },
  });
}
