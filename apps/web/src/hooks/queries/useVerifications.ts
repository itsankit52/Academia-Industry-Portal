import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPatch } from '@/lib/api';
import type { Document as ApiDocument, Paginated } from '@aip/types';
import type { DocumentType, VerificationStatus } from '@aip/config';
import { queryKeys } from './queryKeys';

export interface VerificationQueueFilters {
  page?: number;
  pageSize?: number;
  documentType?: DocumentType;
  userId?: string;
  since?: string;
}

function stripEmpty(obj: VerificationQueueFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '' && v !== null) out[k] = v;
  }
  return out;
}

export function useVerificationQueue(scope: string, filters: VerificationQueueFilters = {}) {
  const params = stripEmpty(filters);
  return useQuery({
    queryKey: queryKeys.verifications.queue(scope, params),
    queryFn: () => apiGet<Paginated<ApiDocument>>('/documents/verification-queue', { params }),
  });
}

export interface VerifyDocumentInput {
  id: string;
  verificationStatus: Extract<VerificationStatus, 'VERIFIED' | 'REJECTED'>;
  verificationNotes?: string;
}

export function useVerifyDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, verificationStatus, verificationNotes }: VerifyDocumentInput) =>
      apiPatch<ApiDocument>(`/documents/${id}/verify`, {
        verificationStatus,
        ...(verificationNotes ? { verificationNotes } : {}),
      }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['verifications', 'queue'] });
      toast.success(vars.verificationStatus === 'VERIFIED' ? 'Document verified.' : 'Document rejected.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update verification status.');
    },
  });
}
