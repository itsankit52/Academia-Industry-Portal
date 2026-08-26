import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Application, Interview } from '@aip/types';
import { queryKeys } from './queryKeys';

export interface DashboardData {
  appliedCount: number;
  interviewCount: number;
  recommendationCount: number;
  missingSkillsCount: number;
  recentApplications: Application[];
  upcomingInterviews: Interview[];
}

export function useStudentDashboard() {
  return useQuery({
    queryKey: queryKeys.studentDashboard(),
    queryFn: () => apiGet<DashboardData>('/students/me/dashboard'),
  });
}
