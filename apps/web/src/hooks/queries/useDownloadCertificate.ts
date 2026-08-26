import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export function useDownloadCertificate(appId: string) {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post(`/applications/${appId}/certificate`, undefined, {
        responseType: 'blob',
      });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificate-${appId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Certificate downloaded.'),
    onError: (err: Error) => toast.error(err.message ?? 'Failed to download certificate.'),
  });
}
