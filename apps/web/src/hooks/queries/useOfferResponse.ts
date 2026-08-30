import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Application } from '@aip/types';

/**
 * Phase 6A — Student offer response.
 *
 * `POST /applications/:id/offer-response` is gated to STUDENT and is the only
 * path through which a student can transition a `SELECTED` application to
 * `OFFER_ACCEPTED` / `OFFER_REJECTED`. The server enforces the transition and
 * the ownership check, so this hook only owns the UX surface: the toast and
 * the cache invalidations that keep the application list, the detail page and
 * the company-side views in step with the new state.
 */
export type OfferResponseAction = 'ACCEPT' | 'REJECT';

export function useOfferResponse(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, response }: { id: string; response: OfferResponseAction }) =>
      apiPost<Application>(`/applications/${id}/offer-response`, { response }),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.response === 'ACCEPT'
          ? 'You have accepted the offer. Congratulations!'
          : 'You have declined the offer.',
      );
      qc.invalidateQueries({ queryKey: ['application', applicationId] });
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['company', 'applicants'] });
      qc.invalidateQueries({ queryKey: ['company', 'candidate'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
