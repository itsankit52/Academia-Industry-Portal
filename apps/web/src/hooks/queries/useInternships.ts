import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Paginated, Internship } from '@aip/types';
import { queryKeys } from './queryKeys';

export interface InternshipFilters {
  search?: string;
  workMode?: string;
  location?: string;
  page?: number;
  pageSize?: number;
  status?: string;
}

export type InternshipWithMatch = Internship & { matchScore?: number };

export function useInternships(filters: InternshipFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.workMode) params.set('workMode', filters.workMode);
  if (filters.location) params.set('location', filters.location);
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 12));

  return useQuery({
    queryKey: queryKeys.internships(filters),
    queryFn: () => apiGet<Paginated<InternshipWithMatch>>(`/internships?${params.toString()}`),
  });
}
