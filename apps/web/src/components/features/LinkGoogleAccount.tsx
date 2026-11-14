/**
 * Link a Google account to the signed-in password account (ISS-08).
 *
 * Two confirmations, both required by the backend: a fresh Google ID token
 * (proves control of the Google account) and the current AcadIn password
 * (proves the person at the keyboard owns this account, not just the session).
 * The token lives only in component state and is dropped once used or rejected.
 * There is no unlink here: the backend does not support one.
 */
import { useCallback, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { FiCheckCircle } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import GoogleSignInButton from '@/components/ui/GoogleSignInButton';
import { useAuthStore } from '@/store/auth';
import { describeLinkError, useLinkGoogleAccount } from '@/hooks/mutations/useLinkGoogleAccount';

/** The token's email claim, for display only (the server does the verifying). */
function googleEmailOf(idToken: string): string | undefined {
  try {
    const payload = idToken.split('.')[1] ?? '';
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const email = (JSON.parse(json) as { email?: unknown }).email;
    return typeof email === 'string' ? email : undefined;
  } catch {
    return undefined;
  }
}

export default function LinkGoogleAccount() {
  const user = useAuthStore((s) => s.user);
  const link = useLinkGoogleAccount();

  const [idToken, setIdToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  const onToken = useCallback((token: string) => {
    setIdToken(token);
    setFormError(undefined);
  }, []);

  if (!user) return null;

  if (user.authProvider === 'both' || user.authProvider === 'google') {
    return (
      <div className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
        <FiCheckCircle className="mt-0.5 w-5 h-5 shrink-0 text-emerald-600" aria-hidden="true" />
        <p>
          {user.authProvider === 'both'
            ? 'Google sign-in is linked. You can sign in with Google or with your password.'
            : 'This account signs in with Google.'}
        </p>
      </div>
    );
  }

  const pending = link.isPending;
  const chosenEmail = idToken ? googleEmailOf(idToken) : undefined;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setFormError(undefined);
    setPasswordError(undefined);
    if (!idToken) {
      setFormError('Choose your Google account first.');
      return;
    }
    if (!password) {
      setPasswordError('Enter your current password.');
      return;
    }
    link.mutate(
      { idToken, currentPassword: password },
      {
        onSuccess: () => {
          setIdToken(null);
          setPassword('');
          toast.success('Google account linked. You can now sign in with Google.');
        },
        onError: (err) => {
          const failure = describeLinkError(err);
          // A rejected token or identity cannot be retried; a password typo can.
          if (failure.target === 'google' || failure.target === 'session') setIdToken(null);
          if (failure.target === 'password') setPasswordError(failure.message);
          else setFormError(failure.message);
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
        <p>
          Linking lets you sign in to AcadIn with your Google account as well as your password. Your
          email, password, profile and data stay exactly as they are.
        </p>
        <p>
          To confirm it&apos;s you, choose your Google account and enter your current AcadIn
          password. A Google account can be linked to only one AcadIn account.
        </p>
      </div>

      <div>
        <p className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300">
          1. Google account
        </p>
        {idToken ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
            <span className="text-slate-700 dark:text-slate-200 break-all">
              {chosenEmail ?? 'Google account selected'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setIdToken(null)}
            >
              Choose a different account
            </Button>
          </div>
        ) : (
          <GoogleSignInButton onToken={onToken} disabled={pending} text="continue_with" />
        )}
      </div>

      <Input
        id="link-google-current-password"
        label="2. Current password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        disabled={pending}
        error={passwordError}
        onChange={(e) => {
          setPassword(e.target.value);
          setPasswordError(undefined);
        }}
      />

      {formError && (
        <p
          className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2"
          role="alert"
        >
          {formError}
        </p>
      )}

      <Button type="submit" loading={pending} disabled={pending || !idToken}>
        Link Google account
      </Button>
    </form>
  );
}
