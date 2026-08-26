import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Interview, Paginated } from '@aip/types';
import { queryKeys } from './queryKeys';

export type InterviewTab = 'upcoming' | 'past';

export function useInterviews(tab: InterviewTab = 'upcoming') {
  return useQuery({
    queryKey: queryKeys.studentInterviews(tab),
    queryFn: () => apiGet<Paginated<Interview>>(`/interviews?tab=${tab}`),
  });
}
