import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPatch } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { StudentProfile, Paginated } from '@aip/types';

export interface StudentRow {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  college?: string;
  branch?: string;
  graduationYear?: number;
  cgpa?: number;
  skillsCount: number;
  applicationsCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface AdminStudentsFilters {
  college?: string;
  branch?: string;
  gradYear?: string;
  minCgpa?: string;
  q?: string;
}

export function useAdminStudents(filters?: AdminStudentsFilters) {
  return useQuery({
    queryKey: queryKeys.admin.students(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.college) params.set('college', filters.college);
      if (filters?.branch) params.set('branch', filters.branch);
      if (filters?.gradYear) params.set('gradYear', filters.gradYear);
      if (filters?.minCgpa) params.set('minCgpa', filters.minCgpa);
      if (filters?.q) params.set('q', filters.q);
      const qs = params.toString();
      return apiGet<Paginated<StudentRow>>(`/students${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useAdminStudentProfile(userId: string) {
  return useQuery({
    queryKey: ['admin', 'student', userId],
    queryFn: () => apiGet<StudentProfile>(`/students/${userId}`),
    enabled: !!userId,
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiPatch<void>(`/admin/users/${id}`, { isActive }),
    onSuccess: () => {
      toast.success('User status updated.');
      qc.invalidateQueries({ queryKey: ['admin', 'students'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
