import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { RegisterInput } from '@aip/validation';
import type { PublicUser } from '@aip/types';
import type { Role } from '@aip/config';
import { apiPost } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface RegisterResponse {
  user: PublicUser;
}

function dashboardPath(role: Role): string {
  switch (role) {
    case 'STUDENT':
      return '/student/dashboard';
    case 'COMPANY':
      return '/company/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    case 'FACULTY':
      return '/faculty/dashboard';
    case 'INSTITUTION':
      return '/institution/dashboard';
  }
}

export function useRegister() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (data: RegisterInput) => apiPost<RegisterResponse>('/auth/register', data),
    onSuccess: ({ user }) => {
      setUser(user);
      toast.success('Account created! Welcome aboard.');
      navigate(dashboardPath(user.role), { replace: true });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Registration failed. Please try again.');
    },
  });
}
