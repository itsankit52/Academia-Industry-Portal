import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import type { TrainingEnrollment } from '@aip/types';
import type { TrainingEnrollmentStatus } from '@aip/config';
import { queryKeys } from './queryKeys';

export interface EnrollmentFilters {
  page?: number;
  pageSize?: number;
  status?: TrainingEnrollmentStatus;
}

function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function useMyEnrollments(filters: EnrollmentFilters = {}) {
  const qs = toQuery(filters as Record<string, unknown>);
  return useQuery({
    queryKey: queryKeys.training.enrollments(filters),
    queryFn: () =>
      apiGet<{ items: TrainingEnrollment[]; total: number; page: number; pageSize: number }>(
        `/training/enrollments/mine${qs}`,
      ),
  });
}

export function useMyEnrollment(enrollmentId: string) {
  return useQuery({
    queryKey: queryKeys.training.enrollment(enrollmentId),
    queryFn: () => apiGet<TrainingEnrollment>(`/training/enrollments/${enrollmentId}`),
    enabled: !!enrollmentId,
  });
}

export function useEnrollInTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trainingId: string) =>
      apiPost<TrainingEnrollment>(`/training/${trainingId}/enroll`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training', 'enrollments'] });
      toast.success('Enrolled in training!');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to enroll.'),
  });
}

export function useUpdateTrainingProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, progress }: { id: string; progress: number }) =>
      apiPatch<TrainingEnrollment>(`/training/enrollments/${id}/progress`, { progress }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training', 'enrollments'] });
      toast.success('Progress saved.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save progress.'),
  });
}

export function useCompleteTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: string) =>
      apiPost<TrainingEnrollment>(`/training/enrollments/${enrollmentId}/complete`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training', 'enrollments'] });
      toast.success('Training completed! Certificate is available.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to complete training.'),
  });
}

export function useDropEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: string) =>
      apiDelete<void>(`/training/enrollments/${enrollmentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training', 'enrollments'] });
      toast.success('Enrollment dropped.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to drop enrollment.'),
  });
}
