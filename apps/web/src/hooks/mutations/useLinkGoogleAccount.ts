import { useMutation } from '@tanstack/react-query';
import type { PublicUser } from '@aip/types';
import { apiPost } from '@/lib/api';
import { ApiClientError } from '@/lib/ApiClientError';
import { useAuthStore } from '@/store/auth';

/**
 * POST /auth/google/link — attach a Google sign-in to the signed-in password
 * account. Contract (backend Phase 1): JSON body `{ idToken, currentPassword }`,
 * the session cookie (the shared axios instance sends credentials), and a
 * browser `Origin` matching FRONTEND_URL. The ID token must be fresh (≤10 min).
 */
export interface LinkGoogleInput {
  idToken: string;
  currentPassword: string;
}

export function linkGoogleAccount(input: LinkGoogleInput): Promise<{ user: PublicUser }> {
  return apiPost<{ user: PublicUser }>('/auth/google/link', {
    idToken: input.idToken,
    currentPassword: input.currentPassword,
  });
}

/**
 * Where a failure should be shown, and whether the Google selection is spent:
 * - `password`: wrong/missing current password; the Google choice stays.
 * - `google`:   the token or identity was rejected; choose Google again.
 * - `session`:  the AcadIn session is gone; sign in again.
 * - `form`:     anything else (rate limit, network, unexpected).
 */
export type LinkFailureTarget = 'password' | 'google' | 'session' | 'form';

export interface LinkFailure {
  target: LinkFailureTarget;
  message: string;
}

// The backend uses generic codes (UNAUTHORIZED, FORBIDDEN), so the few cases
// that need a specific place in the UI are told apart by their fixed messages.
const SESSION_MESSAGES = new Set(['Authentication required', 'Invalid session']);
const WRONG_PASSWORD_MESSAGE = 'Password confirmation failed';

export function describeLinkError(err: unknown): LinkFailure {
  if (!(err instanceof ApiClientError) || err.status === undefined) {
    return {
      target: 'form',
      message: 'Could not reach AcadIn. Check your connection and try again.',
    };
  }
  switch (err.status) {
    case 400:
      return /currentPassword/.test(err.message)
        ? { target: 'password', message: 'Enter your current password.' }
        : { target: 'form', message: err.message };
    case 401:
      return SESSION_MESSAGES.has(err.message)
        ? {
            target: 'session',
            message: 'Your session has ended. Sign in again, then link your Google account.',
          }
        : { target: 'google', message: err.message };
    case 403:
      return err.message === WRONG_PASSWORD_MESSAGE
        ? { target: 'password', message: 'Current password is incorrect.' }
        : { target: 'form', message: err.message };
    case 409:
      return { target: 'google', message: err.message };
    case 415:
      return {
        target: 'form',
        message: 'The request was not sent in the expected format. Refresh the page and try again.',
      };
    case 429:
      return {
        target: 'form',
        message: 'Too many attempts. Wait a couple of minutes, then try again.',
      };
    default:
      return {
        target: 'form',
        message: err.message || 'Could not link your Google account. Please try again.',
      };
  }
}

export function useLinkGoogleAccount() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: linkGoogleAccount,
    // The response carries the updated user (authProvider: 'both').
    onSuccess: ({ user }) => setUser(user),
  });
}
