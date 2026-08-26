import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Resume, ApiSuccess } from '@aip/types';
import { queryKeys } from './queryKeys';

export interface UploadResumeInput {
  file: File;
  onProgress?: (percent: number) => void;
}

export function useUploadResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, onProgress }: UploadResumeInput) => {
      const formData = new FormData();
      formData.append('resume', file);
      const { data } = await api.post<ApiSuccess<Resume>>('/resumes/me', formData, {
        onUploadProgress: (e) => {
          if (e.total) {
            onProgress?.(Math.round((e.loaded * 100) / e.total));
          }
        },
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studentResume() });
      toast.success('Resume uploaded successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to upload resume.');
    },
  });
}
