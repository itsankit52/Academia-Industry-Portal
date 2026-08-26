import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { queryClient } from '@/lib/queryClient';

export function useLogout() {
  const navigate = useNavigate();
  const clearUser = useAuthStore((s) => s.clearUser);

  return useMutation({
    mutationFn: () => apiPost<void>('/auth/logout'),
    onSettled: () => {
      sessionStorage.removeItem('accessToken');
      clearUser();
      queryClient.clear();
      navigate('/login', { replace: true });
      toast.success('You have been signed out.');
    },
  });
}
