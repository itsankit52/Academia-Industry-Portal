import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPut, apiPost } from '@/lib/api';
import type { Application } from '@aip/types';

/**
 * Phase 6B — Company sets or updates offer details for a selected candidate.
 *
 * `PUT /applications/:id/offer-details` is gated to COMPANY/ADMIN and stores
 * the candidate-specific package (salary, joining date, terms, expiry) on the
 * application document.
 */
export interface SetOfferDetailsInput {
  offeredSalary?: number;
  currency?: string;
  joiningDate?: string;
  offerTerms?: string;
  offerExpiresAt?: string;
}

export function useSetOfferDetails(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetOfferDetailsInput) =>
      apiPut<Application>(`/applications/${applicationId}/offer-details`, input),
    onSuccess: () => {
      toast.success('Offer details saved.');
      qc.invalidateQueries({ queryKey: ['application', applicationId] });
      qc.invalidateQueries({ queryKey: ['company', 'candidate'] });
      qc.invalidateQueries({ queryKey: ['company', 'applicants'] });
      qc.invalidateQueries({ queryKey: ['student', 'application', applicationId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Phase 6B — Company uploads an offer letter document and attaches it to the
 * application.
 *
 * First uploads the document through `POST /documents` (the existing upload
 * route), then wires the returned document id to the application via
 * `POST /applications/:id/offer-letter`.
 *
 * The upload flow (multipart/form-data → API → Cloudinary/database) is handled
 * by the document API; this hook drives the two-step attach sequence.
 */
export interface UploadOfferLetterInput {
  documentId: string;
}

export function useAttachOfferLetter(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadOfferLetterInput) =>
      apiPost<Application>(`/applications/${applicationId}/offer-letter`, input),
    onSuccess: () => {
      toast.success('Offer letter attached.');
      qc.invalidateQueries({ queryKey: ['application', applicationId] });
      qc.invalidateQueries({ queryKey: ['company', 'candidate'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
