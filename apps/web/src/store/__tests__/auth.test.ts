import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PublicUser } from '@aip/types';
import { useAuthStore } from '../auth';
import { apiGet } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

const mockUser: PublicUser = {
  id: 'u-1',
  email: 'test@example.com',
  role: 'STUDENT',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isBooting: true });
    vi.mocked(apiGet).mockReset();
  });

  it('setUser assigns the user', () => {
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('clearUser nulls user and stops booting', () => {
    useAuthStore.setState({ user: mockUser, isBooting: true });
    useAuthStore.getState().clearUser();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isBooting).toBe(false);
  });

  it('hydrate fetches /auth/me and populates user', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({ user: mockUser });
    await useAuthStore.getState().hydrate();
    expect(apiGet).toHaveBeenCalledWith('/auth/me');
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isBooting).toBe(false);
  });

  it('hydrate clears user when request fails', async () => {
    vi.mocked(apiGet).mockRejectedValueOnce(new Error('unauthorized'));
    await useAuthStore.getState().hydrate();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isBooting).toBe(false);
  });
});
