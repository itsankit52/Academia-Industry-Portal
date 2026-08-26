import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { TrainingProgram, Paginated } from '@aip/types';
import type { CreateTrainingInput, UpdateTrainingInput } from '@aip/validation';

export function useAdminTrainings(filters?: { status?: string; q?: string }) {
  return useQuery({
    queryKey: queryKeys.admin.trainings(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.q) params.set('q', filters.q);
      const qs = params.toString();
      return apiGet<Paginated<TrainingProgram>>(`/training${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useCreateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTrainingInput) => apiPost<TrainingProgram>('/training', data),
    onSuccess: () => {
      toast.success('Training created.');
      qc.invalidateQueries({ queryKey: ['admin', 'trainings'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTrainingInput }) =>
      apiPatch<TrainingProgram>(`/training/${id}`, data),
    onSuccess: () => {
      toast.success('Training updated.');
      qc.invalidateQueries({ queryKey: ['admin', 'trainings'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/training/${id}`),
    onSuccess: () => {
      toast.success('Training deleted.');
      qc.invalidateQueries({ queryKey: ['admin', 'trainings'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
