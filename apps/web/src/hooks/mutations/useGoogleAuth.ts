/**
 * useGoogleAuth
 *
 * Mutation hook for authenticating with Google on the AcadIn backend.
 * Handles all three outcomes the backend can return:
 *   authenticated       — session cookies were set; redirect to dashboard.
 *   requiresOnboarding  — new Google user; caller should show role-selection UI.
 *   emailConflict       — a local account already uses this email; caller shows link UI.
 */

import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { PublicUser } from '@aip/types';
import type { Role } from '@aip/config';
import type { GoogleAuthInput } from '@aip/validation';
import { apiPost } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

// ── Response shapes from POST /auth/google ──────────────────────────────────

interface AuthenticatedResponse {
  user: PublicUser;
  requiresOnboarding?: false;
  emailConflict?: false;
}

export interface OnboardingResponse {
  requiresOnboarding: true;
  email: string;
  name?: string;
  picture?: string;
}

export interface EmailConflictResponse {
  emailConflict: true;
  email: string;
  message: string;
}

type GoogleAuthResponse = AuthenticatedResponse | OnboardingResponse | EmailConflictResponse;

// ── Dashboard routing (mirrors useLogin / useRegister) ──────────────────────

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

// ── Hook ────────────────────────────────────────────────────────────────────

interface UseGoogleAuthOptions {
  /** Called when backend reports a new user who hasn't selected a role yet. */
  onNeedsOnboarding?: (data: OnboardingResponse) => void;
  /** Called when the Google email is already taken by a local account. */
  onEmailConflict?: (data: EmailConflictResponse) => void;
}

export function useGoogleAuth(options: UseGoogleAuthOptions = {}) {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (input: GoogleAuthInput) => apiPost<GoogleAuthResponse>('/auth/google', input),

    onSuccess: (data) => {
      // New user — needs role selection before a session is created.
      if ('requiresOnboarding' in data && data.requiresOnboarding) {
        options.onNeedsOnboarding?.(data as OnboardingResponse);
        return;
      }

      // Email conflict — local account exists; show link UI.
      if ('emailConflict' in data && data.emailConflict) {
        options.onEmailConflict?.(data as EmailConflictResponse);
        return;
      }

      // Fully authenticated.
      const { user } = data as AuthenticatedResponse;
      setUser(user);
      toast.success('Signed in with Google!');
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      navigate(redirect ?? dashboardPath(user.role), { replace: true });
    },

    onError: (err: Error) => {
      toast.error(err.message ?? 'Google sign-in failed. Please try again.');
    },
  });
}
