import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Paginated } from '@aip/types';

export interface DashboardStats {
  studentCount: number;
  facultyCount: number;
  activeApplicationsCount: number;
  placementsCount: number;
  interviewsScheduledCount: number;
  avgMatchScore: number;
  publishedJobsCount: number;
  publishedInternshipsCount: number;
  verifiedDocumentsCount: number;
  pendingDocumentsCount: number;
}

export interface StudentRow {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  branch?: string;
  semester?: number;
  graduationYear?: number;
  cgpa?: number;
}

export interface StudentDetail {
  id: string;
  fullName: string;
  branch?: string;
  semester?: number;
  graduationYear?: number;
  cgpa?: number;
  bio?: string;
  college?: string;
  university?: string;
  degree?: string;
  phone?: string;
  city?: string;
  state?: string;
  gender?: string;
  preferredRoles: string[];
  preferredLocations: string[];
  projects: { title: string; description?: string; techStack: string[]; link?: string }[];
  certifications: { title: string; issuer: string; issuedAt?: string; credentialUrl?: string }[];
  experience: { title: string; organization: string; startDate?: string; endDate?: string; description?: string }[];
  achievements: { title: string; description?: string; date?: string }[];
  user: { id: string; email: string; isActive: boolean };
  createdAt: string;
  updatedAt: string;
}

export interface FacultyRow {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  department: string;
  designation: string;
  qualificationsCount: number;
  researchInterestsCount: number;
}

export interface FacultyDetail {
  id: string;
  fullName: string;
  designation: string;
  department: string;
  employeeCode?: string;
  phone?: string;
  bio?: string;
  city?: string;
  state?: string;
  gender?: string;
  qualifications: string[];
  researchInterests: string[];
  user: { id: string; email: string; isActive: boolean };
  createdAt: string;
  updatedAt: string;
}

export interface SkillGapItem {
  skillId: string;
  name: string;
  category?: string;
  missingCount: number;
  percentage: number;
}

export interface PlacementMetrics {
  byStatus: { status: string; count: number }[];
  byMonth: { month: string; count: number }[];
  byBranch: { branch: string; placedCount: number; totalCount: number; rate: number }[];
}

export interface FdpParticipation {
  totalFaculty: number;
  appliedToFdps: number;
  acceptedToFdps: number;
  completedFdps: number;
  byFacultyDept: { department: string; applied: number; accepted: number; completed: number }[];
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function useInstitutionStats(institutionId?: string) {
  return useQuery({
    queryKey: queryKeys.institution.stats(institutionId),
    queryFn: () => apiGet<DashboardStats>(`/institution/dashboard/stats${qs({ institutionId })}`),
  });
}

export interface InstitutionStudentsFilters {
  page?: number;
  pageSize?: number;
  q?: string;
  branch?: string;
  graduationYear?: string;
  institutionId?: string;
}

export function useInstitutionStudents(filters: InstitutionStudentsFilters = {}) {
  return useQuery({
    queryKey: queryKeys.institution.students(filters),
    queryFn: () =>
      apiGet<Paginated<StudentRow>>(
        `/institution/dashboard/students${qs({
          institutionId: filters.institutionId,
          page: filters.page,
          pageSize: filters.pageSize,
          q: filters.q,
          branch: filters.branch,
          graduationYear: filters.graduationYear,
        })}`,
      ),
  });
}

export function useInstitutionStudent(id: string, institutionId?: string) {
  return useQuery({
    queryKey: queryKeys.institution.student(id),
    queryFn: () => apiGet<StudentDetail>(`/institution/students/${id}${qs({ institutionId })}`),
    enabled: !!id,
  });
}

export interface InstitutionFacultyFilters {
  page?: number;
  pageSize?: number;
  q?: string;
  department?: string;
  designation?: string;
  institutionId?: string;
}

export function useInstitutionFaculty(filters: InstitutionFacultyFilters = {}) {
  return useQuery({
    queryKey: queryKeys.institution.faculty(filters),
    queryFn: () =>
      apiGet<Paginated<FacultyRow>>(
        `/institution/dashboard/faculty${qs({
          institutionId: filters.institutionId,
          page: filters.page,
          pageSize: filters.pageSize,
          q: filters.q,
          department: filters.department,
          designation: filters.designation,
        })}`,
      ),
  });
}

export function useInstitutionFacultyMember(id: string, institutionId?: string) {
  return useQuery({
    queryKey: queryKeys.institution.facultyMember(id),
    queryFn: () => apiGet<FacultyDetail>(`/institution/faculty/${id}${qs({ institutionId })}`),
    enabled: !!id,
  });
}

export function useInstitutionSkillGaps(institutionId?: string) {
  return useQuery({
    queryKey: queryKeys.institution.skillGaps(institutionId),
    queryFn: () =>
      apiGet<SkillGapItem[]>(`/institution/dashboard/skill-gaps${qs({ institutionId })}`),
  });
}

export function useInstitutionPlacements(institutionId?: string) {
  return useQuery({
    queryKey: queryKeys.institution.placements(institutionId),
    queryFn: () =>
      apiGet<PlacementMetrics>(`/institution/dashboard/placement-metrics${qs({ institutionId })}`),
  });
}

export function useInstitutionFdps(institutionId?: string) {
  return useQuery({
    queryKey: queryKeys.institution.fdps(institutionId),
    queryFn: () =>
      apiGet<FdpParticipation>(`/institution/dashboard/fdp-participation${qs({ institutionId })}`),
  });
}
