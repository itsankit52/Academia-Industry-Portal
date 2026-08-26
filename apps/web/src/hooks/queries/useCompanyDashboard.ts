import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Application, Interview } from '@aip/types';

export interface CompanyDashboardData {
  activeJobsCount: number;
  activeInternshipsCount: number;
  applicantsCount: number;
  interviewsCount: number;
  recentApplicants: Application[];
  upcomingInterviews: Interview[];
}

export function useCompanyDashboard() {
  return useQuery({
    queryKey: queryKeys.company.dashboard(),
    queryFn: () => apiGet<CompanyDashboardData>('/companies/me/dashboard'),
  });
}
