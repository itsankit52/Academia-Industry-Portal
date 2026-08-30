import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, api } from '@/lib/api';

/**
 * Phase 6B — Download the offer letter attached to an application.
 *
 * The backend exposes the metadata through `GET /applications/:id/offer-letter`
 * and reuses the existing `/documents/:id/download` route to stream the
 * binary. This hook combines the two: fetch the metadata, then open the
 * binary in a new tab using the configured axios baseURL.
 */
export interface OfferLetterMeta {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
}

export function useDownloadOfferLetter(applicationId: string) {
  return useMutation({
    mutationFn: async () => {
      const meta = await apiGet<OfferLetterMeta | null>(
        `/applications/${applicationId}/offer-letter`,
      );
      if (!meta) throw new Error('No offer letter attached yet.');
      // The document download route exists on the documents module; the
      // browser will follow the Content-Disposition header set there.
      // Use the axios instance baseURL so it picks up VITE_API_URL.
      const baseURL = api.defaults.baseURL ?? '';
      window.open(`${baseURL}/documents/${meta.id}/download`, '_blank');
      return meta;
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
