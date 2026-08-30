import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import type { Application } from '@aip/types';

/**
 * Phase 6B — Student-initiated withdrawal of an accepted offer.
 *
 * `POST /applications/:id/withdraw-offer` is gated to STUDENT and only accepts
 * a transition from `OFFER_ACCEPTED → WITHDRAWAL_REQUESTED`. The server enforces
 * the transition and the ownership check; this hook only owns the UX surface.
 */
export function useWithdrawOffer(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reason }: { reason?: string }) =>
      apiPost<Application>(`/applications/${applicationId}/withdraw-offer`, { reason }),
    onSuccess: () => {
      toast.success('Withdrawal request submitted.');
      qc.invalidateQueries({ queryKey: ['application', applicationId] });
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['company', 'applicants'] });
      qc.invalidateQueries({ queryKey: ['company', 'candidate'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
