import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPatch, apiPut } from '@/lib/api';
import type { Application } from '@aip/types';
import type { RecruitmentSource } from '@aip/config';

/* ============================================================
   Phase 7B hooks — placement completion, recruitment source, verification
   ============================================================ */

/**
 * `PUT /applications/:id/recruitment-source` — company sets the recruitment
 * source for a specific application. Each candidate's source is recorded
 * independently so analytics can aggregate by source.
 */
export function useSetRecruitmentSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      source,
    }: {
      id: string;
      source: RecruitmentSource;
    }) =>
      apiPut<Application>(`/applications/${id}/recruitment-source`, { source }),
    onSuccess: () => {
      toast.success('Recruitment source updated.');
      qc.invalidateQueries({ queryKey: ['company', 'applicants'] });
      qc.invalidateQueries({ queryKey: ['company', 'candidate'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * `PATCH /applications/:id/placement-complete` — company marks an accepted
 * placement as completed (candidate has joined). Distinct from OFFER_ACCEPTED
 * (student accepted the offer letter) — this records the company confirming
 * the candidate is now in the role.
 *
 * Only OFFER_ACCEPTED applications are eligible.
 */
export function useCompletePlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      placedAt,
      notes,
    }: {
      id: string;
      placedAt?: string;
      notes?: string;
    }) =>
      apiPatch<Application>(`/applications/${id}/placement-complete`, {
        ...(placedAt ? { placedAt } : {}),
        ...(notes ? { notes } : {}),
      }),
    onSuccess: () => {
      toast.success('Placement marked as completed.');
      qc.invalidateQueries({ queryKey: ['company', 'applicants'] });
      qc.invalidateQueries({ queryKey: ['company', 'candidate'] });
      qc.invalidateQueries({ queryKey: ['institution'] });
      qc.invalidateQueries({ queryKey: ['application'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * `PATCH /applications/:id/placement-verify` — institution or admin verifies
 * a placement. Only INSTITUTION (own students) or ADMIN (cross-institution)
 * may call this.
 *
 * Verification status: PENDING → VERIFIED or REJECTED.
 */
export function useVerifyPlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string;
      status: 'PENDING' | 'VERIFIED' | 'REJECTED';
      note?: string;
    }) =>
      apiPatch<Application>(`/applications/${id}/placement-verify`, {
        status,
        ...(note ? { note } : {}),
      }),
    onSuccess: () => {
      toast.success('Placement verification updated.');
      qc.invalidateQueries({ queryKey: ['institution'] });
      qc.invalidateQueries({ queryKey: ['application'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
