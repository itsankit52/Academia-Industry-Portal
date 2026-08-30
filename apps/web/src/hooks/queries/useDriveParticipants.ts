/**
 * Phase 11 — Drive participant hooks.
 *
 * Covers eligibility preview/explanation, registration (single + bulk),
 * participant listing, status transitions and withdrawals.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { queryKeys } from './queryKeys';

export interface EligibilityResult {
  eligible: boolean;
  failures: Array<{ rule: string; message: string; expected?: string; actual?: string }>;
  warnings: Array<{ rule: string; message: string }>;
  evaluatedAt: string;
}

export interface PlacementParticipant {
  id: string;
  drive: string;
  student: string;
  studentProfile?: { fullName?: string; branch?: string; graduationYear?: number; cgpa?: number };
  company: { id: string; companyName?: string; logo?: string };
  opportunity?: { opportunityType: string; opportunityId: string };
  registeredAt: string;
  currentRound?: string;
  lastActivityAt?: string;
  status: string;
  application?: string;
  interviews: string[];
  timeline: Array<{ status: string; at: string; by?: string; note?: string }>;
  notes?: string;
  withdrawnAt?: string;
  withdrawalReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedParticipants {
  data: PlacementParticipant[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface PaginatedEligibleStudents {
  data: Array<{ profile: Record<string, unknown>; eligibility: EligibilityResult }>;
  total: number;
}

export interface RegisterInput {
  companyId?: string;
  opportunityType?: string;
  opportunityId?: string;
  notes?: string;
}

export interface TransitionInput {
  toStatus: string;
  reason?: string;
  note?: string;
}

export function useDriveEligibilityPreview(driveId: string) {
  return useQuery({
    queryKey: queryKeys.drives.eligibility(driveId),
    queryFn: () => apiGet<EligibilityResult>(`/placement-drives/${driveId}/eligibility-preview`),
    enabled: !!driveId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDriveEligibilityExplanation(driveId: string) {
  return useQuery({
    queryKey: queryKeys.drives.eligibilityExplanation(driveId),
    queryFn: () =>
      apiGet<{ explanation: string[] }>(`/placement-drives/${driveId}/eligibility-explanation`),
    enabled: !!driveId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEligibleStudentsForDrive(driveId: string, filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.drives.eligibleStudents(driveId, filters),
    queryFn: () =>
      apiGet<PaginatedEligibleStudents>(
        `/institution-analytics/placement-drives/${driveId}/eligible-students`,
        { params: filters },
      ),
    enabled: !!driveId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRegisterForDrive(driveId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiPost<{ data: PlacementParticipant }>(`/placement-drives/${driveId}/register`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.drives.eligibility(driveId) });
      qc.invalidateQueries({ queryKey: queryKeys.drives.participants(driveId) });
      qc.invalidateQueries({ queryKey: queryKeys.drives.myParticipations() });
    },
  });
}

export function useBulkRegisterForDrive(driveId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentIds: string[]; reason?: string }) =>
      apiPost<{ registered: number; failed: number; errors: string[] }>(
        `/placement-drives/${driveId}/register-bulk`,
        input,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.drives.participants(driveId) });
      qc.invalidateQueries({ queryKey: queryKeys.drives.eligibleStudents(driveId) });
    },
  });
}

export function useDriveParticipants(driveId: string, filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.drives.participants(driveId, filters),
    queryFn: () =>
      apiGet<PaginatedParticipants>(`/placement-drives/${driveId}/participants`, { params: filters }),
    enabled: !!driveId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDriveParticipant(driveId: string, participantId: string) {
  return useQuery({
    queryKey: queryKeys.drives.participant(driveId, participantId),
    queryFn: () =>
      apiGet<{ data: PlacementParticipant }>(
        `/placement-drives/${driveId}/participants/${participantId}`,
      ).then((r) => r.data),
    enabled: !!driveId && !!participantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTransitionParticipant(driveId: string, participantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransitionInput) =>
      apiPatch<{ data: PlacementParticipant }>(
        `/placement-drives/${driveId}/participants/${participantId}/transition`,
        input,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.drives.participants(driveId) });
      qc.invalidateQueries({ queryKey: queryKeys.drives.participant(driveId, participantId) });
      qc.invalidateQueries({ queryKey: queryKeys.drives.report(driveId) });
    },
  });
}

export function useWithdrawParticipant(driveId: string, participantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiPost<{ data: PlacementParticipant }>(
        `/placement-drives/${driveId}/participants/${participantId}/withdraw`,
        { reason },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.drives.participants(driveId) });
      qc.invalidateQueries({ queryKey: queryKeys.drives.participant(driveId, participantId) });
    },
  });
}

export function useMyParticipations() {
  return useQuery({
    queryKey: queryKeys.drives.myParticipations(),
    queryFn: () =>
      apiGet<{
        participations: PlacementParticipant[];
        total: number;
      }>('/placement-drives/me/participations'),
    staleTime: 5 * 60 * 1000,
  });
}
