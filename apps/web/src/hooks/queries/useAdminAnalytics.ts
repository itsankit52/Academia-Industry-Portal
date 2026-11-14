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

/** Shape actually returned by GET /analytics/dashboard (analytics.service.ts). */
interface DashboardSummaryResponse {
  totals: {
    students: number;
    companies: number;
    jobs: number;
    internships: number;
    applications: number;
  };
  placementRate: number;
  topDemandedSkills: { skillId: string; name: string; count: number }[];
}

type TimeSeries = { date: string; count: number }[];

/**
 * The summary endpoint returns `{ totals: {...} }`, not the flat fields the
 * admin pages read, and the chart series live on their own endpoints. Adapting
 * here keeps AdminDashboard and AdminAnalytics unchanged.
 */
async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [summary, applicationsOverTime, placementsOverTime, jobsByCategory] = await Promise.all([
    apiGet<DashboardSummaryResponse>('/analytics/dashboard'),
    apiGet<TimeSeries>('/analytics/applications-over-time'),
    apiGet<TimeSeries>('/analytics/placements-over-time'),
    apiGet<{ category: string; count: number }[]>('/analytics/jobs-by-category'),
  ]);
  return {
    totalStudents: summary.totals.students,
    totalCompanies: summary.totals.companies,
    totalJobs: summary.totals.jobs,
    totalInternships: summary.totals.internships,
    totalApplications: summary.totals.applications,
    placementRate: summary.placementRate,
    applicationsOverTime,
    placementsOverTime,
    jobsByCategory,
    skillDemand: summary.topDemandedSkills.map((s) => ({ skill: s.name, count: s.count })),
  };
}

export function useAdminDashboardStats() {
  return useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: fetchAdminDashboardStats,
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
        queryFn: fetchAdminDashboardStats,
      },
      {
        queryKey: queryKeys.admin.analyticsPlacements(),
        queryFn: () => apiGet<PlacementAnalyticsItem[]>('/analytics/placements-over-time'),
      },
    ],
  });
}
