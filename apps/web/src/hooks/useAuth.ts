import { useAuthStore } from '@/store/auth';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isBooting = useAuthStore((s) => s.isBooting);
  const hydrate = useAuthStore((s) => s.hydrate);
  const clearUser = useAuthStore((s) => s.clearUser);

  return {
    user,
    isAuthenticated: !!user,
    isBooting,
    hydrate,
    clearUser,
  };
}
