/**
 * Phase 11 — Placement action item hooks.
 *
 * Covers listing, state transitions, and auto-detection of action items
 * for placement drive operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { queryKeys } from './queryKeys';

export interface PlacementActionItem {
  id: string;
  institution: string;
  drive?: { id: string; title: string; status: string };
  participant?: string;
  student?: { id: string; name?: string; email?: string };
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  reason: string;
  recommendedAction?: string;
  ctaPath?: string;
  ctaLabel?: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';
  assigneeRole?: string;
  assignee?: string;
  dueAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionItemFilters {
  type?: string;
  severity?: string;
  status?: string;
  driveId?: string;
  studentId?: string;
  page?: number;
  limit?: number;
}

export function useActionItems(filters?: ActionItemFilters) {
  return useQuery({
    queryKey: queryKeys.actionItems.list(filters as Record<string, unknown> | undefined),
    queryFn: () => apiGet<{ data: PlacementActionItem[] }>('/placement-action-items', { params: filters }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAcknowledgeActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPatch<{ data: PlacementActionItem }>(`/placement-action-items/${id}/acknowledge`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.actionItems.list() });
    },
  });
}

export function useStartActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPatch<{ data: PlacementActionItem }>(`/placement-action-items/${id}/start`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.actionItems.list() });
    },
  });
}

export function useResolveActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolutionNote }: { id: string; resolutionNote?: string }) =>
      apiPatch<{ data: PlacementActionItem }>(`/placement-action-items/${id}/resolve`, { resolutionNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.actionItems.list() });
    },
  });
}

export function useDismissActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolutionNote }: { id: string; resolutionNote?: string }) =>
      apiPatch<{ data: PlacementActionItem }>(`/placement-action-items/${id}/dismiss`, { resolutionNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.actionItems.list() });
    },
  });
}

export function useDetectActionItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ created: number; updated: number }>('/placement-action-items/detect', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.actionItems.list() });
    },
  });
}
