import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiDelete, apiGet } from '@/lib/api';
import type { ApiSuccess, Document as ApiDocument, Paginated } from '@aip/types';
import type { DocumentType, VerificationStatus } from '@aip/config';
import { queryKeys } from './queryKeys';

export interface DocumentFilters {
  page?: number;
  pageSize?: number;
  documentType?: DocumentType;
  verificationStatus?: VerificationStatus;
}

function stripEmpty(obj: DocumentFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '' && v !== null) out[k] = v;
  }
  return out;
}

export function useMyDocuments(filters: DocumentFilters = {}) {
  const params = stripEmpty(filters);
  return useQuery({
    queryKey: queryKeys.documents.mine(params),
    queryFn: () => apiGet<Paginated<ApiDocument>>('/documents/me', { params }),
  });
}

export interface UploadDocumentInput {
  file: File;
  documentType: DocumentType;
  title?: string;
  issuer?: string;
  issuedDate?: string;
  onProgress?: (percent: number) => void;
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, documentType, title, issuer, issuedDate, onProgress }: UploadDocumentInput) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      if (title) formData.append('title', title);
      if (issuer) formData.append('issuer', issuer);
      if (issuedDate) formData.append('issuedDate', issuedDate);
      const { data } = await api.post<ApiSuccess<ApiDocument>>('/documents/me', formData, {
        onUploadProgress: (e) => {
          if (e.total) onProgress?.(Math.round((e.loaded * 100) / e.total));
        },
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'mine'] });
      toast.success('Document uploaded. Awaiting verification.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to upload document.');
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'mine'] });
      toast.success('Document deleted.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to delete document.');
    },
  });
}
