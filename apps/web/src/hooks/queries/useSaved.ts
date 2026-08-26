import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Job, Internship } from '@aip/types';
import { queryKeys } from './queryKeys';

export interface SavedData {
  jobs: Job[];
  internships: Internship[];
}

export function useSaved() {
  return useQuery({
    queryKey: queryKeys.savedOpportunities(),
    queryFn: () => apiGet<SavedData>('/students/me/saved'),
  });
}
