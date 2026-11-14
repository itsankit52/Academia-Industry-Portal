/**
 * Google-only accounts have no password, so the Change Password form is replaced
 * by an explanation. The decision uses the session user's `authProvider`
 * (never googleId); password accounts keep the form.
 */
import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicUser } from '@aip/types';
import ChangePasswordForm from '../ChangePasswordForm';
import CompanySettings from '@/pages/company/CompanySettings';
import { renderWithProviders } from '@/test/renderWithProviders';
import { useAuthStore } from '@/store/auth';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));
vi.mock('@/components/ui/GoogleSignInButton', () => ({ default: () => null }));

const user = (authProvider?: string): PublicUser => ({
  id: 'u1',
  email: 'me@acadin.test',
  role: 'COMPANY',
  isActive: true,
  authProvider,
  createdAt: '',
  updatedAt: '',
});

const setUser = (u: PublicUser) => act(() => useAuthStore.getState().setUser(u));
const NOTICE = /signs in with Google, so it has no AcadIn password to change/i;

beforeEach(() => act(() => useAuthStore.getState().clearUser()));

describe('ChangePasswordForm', () => {
  it.each(['local', 'both', undefined])('authProvider %s: shows the password form', (provider) => {
    setUser(user(provider));
    renderWithProviders(<ChangePasswordForm />);
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it('Google-only: explains instead of showing an unusable form', () => {
    setUser(user('google'));
    renderWithProviders(<ChangePasswordForm />);
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change password/i })).not.toBeInTheDocument();
  });
});

describe('CompanySettings password card', () => {
  it('Google-only company account sees the explanation', () => {
    setUser(user('google'));
    renderWithProviders(<CompanySettings />);
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /update password/i })).not.toBeInTheDocument();
  });

  it('password company account keeps the form', () => {
    setUser(user('local'));
    renderWithProviders(<CompanySettings />);
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });
});
