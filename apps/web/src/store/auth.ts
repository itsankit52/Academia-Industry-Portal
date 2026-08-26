import { create } from 'zustand';
import type { PublicUser } from '@aip/types';
import { apiGet } from '@/lib/api';

interface AuthState {
  user: PublicUser | null;
  isBooting: boolean;
  setUser: (user: PublicUser) => void;
  clearUser: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isBooting: true,
  setUser: (user) => set({ user, isBooting: false }),
  clearUser: () => set({ user: null, isBooting: false }),
  hydrate: async () => {
    try {
      const payload = await apiGet<{ user: PublicUser }>('/auth/me');
      set({ user: payload.user, isBooting: false });
    } catch {
      set({ user: null, isBooting: false });
    }
  },
}));
