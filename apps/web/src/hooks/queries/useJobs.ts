import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Paginated, Job } from '@aip/types';
import { queryKeys } from './queryKeys';

export interface JobFilters {
  search?: string;
  workMode?: string;
  employmentType?: string;
  location?: string;
  minSalary?: string;
  page?: number;
  pageSize?: number;
  status?: string;
}

export type JobWithMatch = Job & { matchScore?: number };

export function useJobs(filters: JobFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.workMode) params.set('workMode', filters.workMode);
  if (filters.employmentType) params.set('employmentType', filters.employmentType);
  if (filters.location) params.set('location', filters.location);
  if (filters.minSalary) params.set('minSalary', filters.minSalary);
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 12));

  return useQuery({
    queryKey: queryKeys.jobs(filters),
    queryFn: () => apiGet<Paginated<JobWithMatch>>(`/jobs?${params.toString()}`),
  });
}
