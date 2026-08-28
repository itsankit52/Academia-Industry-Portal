import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPatch } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Paginated } from '@aip/types';

export interface StudentRow {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface AdminStudentsFilters {
  isActive?: boolean;
}

export function useAdminStudents(filters?: AdminStudentsFilters) {
  return useQuery({
    queryKey: queryKeys.admin.students(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeof filters?.isActive === 'boolean') {
        params.set('isActive', String(filters.isActive));
      }
      // /admin/users is the list endpoint; filter to STUDENT role here because
      // the table is the student list. The /admin/students endpoint that the
      // old code referenced does not exist in this codebase.
      params.set('role', 'STUDENT');
      const qs = params.toString();
      return apiGet<Paginated<StudentRow>>(`/admin/users?${qs}`);
    },
  });
}

export function useAdminStudentProfile(userId: string) {
  return useQuery({
    queryKey: ['admin', 'student', userId],
    queryFn: () => apiGet<StudentRow>(`/admin/users/${userId}`),
    enabled: !!userId,
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => {
      // Use the dedicated /activate and /deactivate action routes so the
      // backend audit log records the intent. The catch-all PATCH /admin/users/:id
      // route exists but the action routes are the documented contract.
      const action = isActive ? 'activate' : 'deactivate';
      return apiPatch<void>(`/admin/users/${id}/${action}`, {});
    },
    onSuccess: () => {
      toast.success('User status updated.');
      qc.invalidateQueries({ queryKey: ['admin', 'students'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
