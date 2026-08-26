import { useQuery, useQueries } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { queryKeys } from './queryKeys';

export interface AdminDashboardStats {
  totalStudents: number;
  totalCompanies: number;
  totalJobs: number;
  totalInternships: number;
  totalApplications: number;
  placementRate: number;
  applicationsOverTime: { date: string; count: number }[];
  placementsOverTime: { date: string; count: number }[];
  jobsByCategory: { category: string; count: number }[];
  skillDemand?: { skill: string; count: number; category?: string }[];
}

export interface PlacementAnalyticsItem {
  branch: string;
  placementRate: number;
  placed: number;
  total: number;
}

export interface IndustrySkillDemandItem {
  skill: string;
  demandPercent: number;
  category?: string;
}

export function useAdminDashboardStats() {
  return useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: () => apiGet<AdminDashboardStats>('/analytics/dashboard'),
  });
}

export function useAdminAnalyticsPlacements() {
  return useQuery({
    queryKey: queryKeys.admin.analyticsPlacements(),
    queryFn: () => apiGet<PlacementAnalyticsItem[]>('/analytics/placements-over-time'),
  });
}

export function useAdminIndustrySkillDemand() {
  return useQuery({
    queryKey: queryKeys.admin.industrySkillDemand(),
    queryFn: () => apiGet<IndustrySkillDemandItem[]>('/analytics/industry-skill-demand'),
  });
}

export function useAdminAnalytics() {
  return useQueries({
    queries: [
      {
        queryKey: queryKeys.admin.dashboard(),
        queryFn: () => apiGet<AdminDashboardStats>('/analytics/dashboard'),
      },
      {
        queryKey: queryKeys.admin.analyticsPlacements(),
        queryFn: () => apiGet<PlacementAnalyticsItem[]>('/analytics/placements-over-time'),
      },
    ],
  });
}
