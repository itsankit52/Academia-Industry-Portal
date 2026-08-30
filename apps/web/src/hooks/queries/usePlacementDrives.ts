/**
 * Phase 11 — Placement drive CRUD hooks.
 *
 * Calls /api/v1/placement-drives endpoints and returns typed responses.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { queryKeys } from './queryKeys';

export interface PlacementDrive {
  id: string;
  institution: string;
  title: string;
  description: string;
  mode: string;
  location?: string;
  participatingCompanies: Array<{ id: string; companyName?: string; logo?: string }>;
  opportunities: Array<{ opportunityType: string; opportunityId: string; openings: number }>;
  eligibilityRules: Record<string, unknown>;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  driveStartsAt?: string;
  driveEndsAt?: string;
  status: string;
  maxParticipationsPerStudent: number;
  totalSlots?: number;
  filledSlots?: number;
  coordinators: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlacementDriveListFilters {
  status?: string;
  mode?: string;
  institutionId?: string;
  companyId?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedDrives {
  data: PlacementDrive[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface CreateDriveInput {
  title: string;
  description: string;
  mode: string;
  location?: string;
  participatingCompanies: string[];
  opportunities?: Array<{ opportunityType: string; opportunityId: string; openings?: number }>;
  eligibilityRules?: Record<string, unknown>;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  driveStartsAt?: string;
  driveEndsAt?: string;
  maxParticipationsPerStudent?: number;
  totalSlots?: number;
  coordinators?: string[];
}

export function usePlacementDrives(filters?: PlacementDriveListFilters) {
  return useQuery({
    queryKey: queryKeys.drives.list(filters as Record<string, unknown> | undefined),
    queryFn: () => apiGet<PaginatedDrives>('/placement-drives', { params: filters }),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlacementDrive(id: string) {
  return useQuery({
    queryKey: queryKeys.drives.detail(id),
    queryFn: () => apiGet<{ data: PlacementDrive }>(`/placement-drives/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatePlacementDrive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDriveInput) =>
      apiPost<{ data: PlacementDrive }>('/placement-drives', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.drives.list() });
    },
  });
}

export function useUpdatePlacementDrive(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateDriveInput>) =>
      apiPatch<{ data: PlacementDrive }>(`/placement-drives/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.drives.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.drives.list() });
    },
  });
}

export function useDuplicatePlacementDrive(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ data: PlacementDrive }>(`/placement-drives/${id}/duplicate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.drives.list() });
    },
  });
}

export function useTransitionDrive(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { targetStatus: string; reason?: string }) =>
      apiPost<{ data: PlacementDrive }>(`/placement-drives/${id}/transition`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.drives.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.drives.list() });
    },
  });
}

export function useCancelDrive(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPatch<{ data: PlacementDrive }>(`/placement-drives/${id}`, { status: 'CANCELLED' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.drives.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.drives.list() });
    },
  });
}
