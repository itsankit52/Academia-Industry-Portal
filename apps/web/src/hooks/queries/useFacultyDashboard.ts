import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Application, FacultyProfile, Interview, Paginated } from '@aip/types';
import type { ApplicationStatus } from '@aip/config';
import { queryKeys } from './queryKeys';

export interface FacultyDashboardData {
  totalApplications: number;
  activeApplications: number;
  activeEngagements: number;
  upcomingInterviewsCount: number;
  profileCompletion: number;
  recentApplications: Application[];
  upcomingInterviews: Interview[];
}

const ACTIVE_STATUSES: ApplicationStatus[] = [
  'APPLIED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
];

const ACTIVE_ENGAGEMENT_STATUSES: ApplicationStatus[] = [
  'SELECTED',
  'OFFER_ACCEPTED',
  'INTERNSHIP_STARTED',
  'ONGOING',
];

function computeProfileCompletion(profile: FacultyProfile | undefined): number {
  if (!profile) return 0;
  const fields: Array<boolean> = [
    !!profile.fullName,
    !!profile.designation,
    !!profile.department,
    !!profile.bio && profile.bio.length > 20,
    profile.qualifications.length > 0,
    profile.researchInterests.length > 0,
    !!profile.phone,
    !!profile.city && !!profile.state,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

export function useFacultyDashboard() {
  return useQuery({
    queryKey: queryKeys.faculty.dashboard(),
    queryFn: async (): Promise<FacultyDashboardData> => {
      const [counts, apps, profile, interviews] = await Promise.all([
        apiGet<Record<ApplicationStatus, number>>('/applications/me/count-by-status'),
        apiGet<Paginated<Application>>('/applications?page=1&pageSize=5'),
        apiGet<FacultyProfile>('/faculty/me/profile'),
        apiGet<Paginated<Interview>>('/interviews/me/upcoming?page=1&pageSize=5').catch(() => ({
          items: [] as Interview[],
          page: 1,
          pageSize: 5,
          total: 0,
          totalPages: 1,
        })),
      ]);

      const totalApplications = (Object.values(counts) as number[]).reduce((sum, v) => sum + v, 0);
      const activeApplications = ACTIVE_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
      const activeEngagements = ACTIVE_ENGAGEMENT_STATUSES.reduce(
        (sum, s) => sum + (counts[s] ?? 0),
        0,
      );

      return {
        totalApplications,
        activeApplications,
        activeEngagements,
        upcomingInterviewsCount: interviews.items.length,
        profileCompletion: computeProfileCompletion(profile),
        recentApplications: apps.items,
        upcomingInterviews: interviews.items,
      };
    },
  });
}
