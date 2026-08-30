/**
 * Phase 11 — Drive outcome hooks.
 *
 * Covers outcome CRUD, verification, and analytics reports for placement drives.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { queryKeys } from './queryKeys';

export interface PlacementDriveOutcome {
  id: string;
  drive: string;
  participant: string;
  application?: string;
  student: string;
  company: { id: string; companyName?: string };
  outcome: string;
  salaryPackage?: { amount?: number; currency?: string; ctcLpa?: number };
  joiningDate?: string;
  offerExpiresAt?: string;
  offerLetterRef?: string;
  notes?: string;
  recordedBy?: string;
  recordedAt: string;
  verification: { status: string; verifiedBy?: string; verifiedAt?: string; note?: string };
  createdAt: string;
  updatedAt: string;
}

export interface DriveReport {
  driveId: string;
  driveTitle: string;
  driveStatus: string;
  institutionId: string;
  totals: Record<string, number>;
  funnel: Array<{ status: string; label: string; count: number }>;
  rates: Record<string, number>;
  byCompany: Array<Record<string, unknown>>;
  byBranch: Array<Record<string, unknown>>;
  salaryStats?: { minLpa: number; maxLpa: number; medianLpa?: number; currency: string; sampleSize: number };
  derived: { placedCount: number; verifiedCount: number; pendingVerification: number };
  verified: { placedCount: number; verifiedCount: number; pendingVerification: number };
  verificationBreakdown: { pending: number; verified: number; rejected: number };
  insufficientData: boolean;
  insufficientReasons: string[];
  generatedAt: string;
}

export interface InstitutionDrivesReport {
  institutionId: string;
  totalDrives: number;
  activeDrives: number;
  completedDrives: number;
  cancelledDrives: number;
  summaryTotals: Record<string, number>;
  aggregateFunnel: Array<{ status: string; label: string; count: number }>;
  aggregateRates: Record<string, number>;
  driveSummaries: Array<Record<string, unknown>>;
  salaryStats?: { overallMinLpa: number; overallMaxLpa: number; currency: string };
  insufficientData: boolean;
  insufficientReasons: string[];
  generatedAt: string;
}

export interface RecordOutcomeInput {
  outcome: string;
  salaryPackage?: { amount?: number; currency?: string; ctcLpa?: number };
  joiningDate?: string;
  offerExpiresAt?: string;
  offerLetterRef?: string;
  notes?: string;
}

export interface VerifyOutcomeInput {
  status: string;
  note?: string;
}

export function useDriveOutcomes(driveId: string, filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.drives.outcomes(driveId, filters),
    queryFn: () =>
      apiGet<{ data: PlacementDriveOutcome[] }>(`/placement-drives/${driveId}/outcomes`, {
        params: filters,
      }),
    enabled: !!driveId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecordOutcome(driveId: string, participantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordOutcomeInput) =>
      apiPost<{ data: PlacementDriveOutcome }>(
        `/placement-drives/${driveId}/participants/${participantId}/outcome`,
        input,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.drives.outcomes(driveId) });
      qc.invalidateQueries({ queryKey: queryKeys.drives.report(driveId) });
    },
  });
}

export function useUpdateOutcome(driveId: string, outcomeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<RecordOutcomeInput>) =>
      apiPatch<{ data: PlacementDriveOutcome }>(`/placement-drives/${driveId}/outcomes/${outcomeId}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.drives.outcomes(driveId) });
      qc.invalidateQueries({ queryKey: queryKeys.drives.report(driveId) });
    },
  });
}

export function useVerifyOutcome(driveId: string, outcomeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VerifyOutcomeInput) =>
      apiPatch<{ data: PlacementDriveOutcome }>(
        `/placement-drives/${driveId}/outcomes/${outcomeId}/verify`,
        input,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.drives.outcomes(driveId) });
      qc.invalidateQueries({ queryKey: queryKeys.drives.report(driveId) });
    },
  });
}

export function useRejectOutcome(driveId: string, outcomeId: string) {
  return useVerifyOutcome(driveId, outcomeId);
}

export function useDriveReport(driveId: string) {
  return useQuery({
    queryKey: queryKeys.drives.report(driveId),
    queryFn: () => apiGet<DriveReport>(`/placement-drives/${driveId}/report`),
    enabled: !!driveId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useInstitutionDrivesReport(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.drives.institutionReport(filters),
    queryFn: () =>
      apiGet<InstitutionDrivesReport>('/institution-analytics/placement-drives/report', {
        params: filters,
      }),
    staleTime: 5 * 60 * 1000,
  });
}
