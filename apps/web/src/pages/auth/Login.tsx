import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@aip/validation';
import { useLogin } from '@/hooks/mutations/useLogin';
import {
  useGoogleAuth,
  type OnboardingResponse,
  type EmailConflictResponse,
} from '@/hooks/mutations/useGoogleAuth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Logo from '@/components/ui/Logo';
import GoogleSignInButton from '@/components/ui/GoogleSignInButton';
import GoogleOnboardingModal from '@/components/features/GoogleOnboardingModal';

export default function Login() {
  const login = useLogin();

  // Google auth state
  const [pendingOnboarding, setPendingOnboarding] = useState<OnboardingResponse | null>(null);
  const [pendingIdToken, setPendingIdToken] = useState('');
  const [emailConflict, setEmailConflict] = useState<EmailConflictResponse | null>(null);

  const googleAuth = useGoogleAuth({
    onNeedsOnboarding: (data) => {
      // Store what the backend sent so the onboarding modal can reference it.
      setPendingOnboarding(data);
    },
    onEmailConflict: (data) => {
      setEmailConflict(data);
    },
  });

  const handleGoogleToken = (idToken: string) => {
    // Keep the token in state so it can be re-sent with the role selection.
    setPendingIdToken(idToken);
    setEmailConflict(null);
    googleAuth.mutate({ idToken });
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  return (
    <>
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block no-underline mb-3">
              <Logo className="h-8" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome back</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              Sign in to your account to continue.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
            {/* Google Sign-In */}
            <div className="mb-5">
              <GoogleSignInButton
                onToken={handleGoogleToken}
                disabled={googleAuth.isPending || login.isPending}
                text="signin_with"
              />
              {googleAuth.error && (
                <p
                  className="mt-2 text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2"
                  role="alert"
                >
                  {googleAuth.error.message}
                </p>
              )}
              {emailConflict && (
                <div
                  className="mt-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2"
                  role="alert"
                >
                  <p className="font-medium">Account already exists</p>
                  <p className="mt-0.5 text-xs">{emailConflict.message}</p>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-white dark:bg-slate-900 px-2 text-slate-400 dark:text-slate-500">
                  or continue with email
                </span>
              </div>
            </div>

            {/* Email / Password form */}
            <form
              onSubmit={handleSubmit((data) => login.mutate(data))}
              noValidate
              className="space-y-5"
            >
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register('password')}
              />

              {login.error && (
                <p
                  className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2"
                  role="alert"
                >
                  {login.error.message}
                </p>
              )}

              <Button type="submit" className="w-full" loading={login.isPending}>
                Sign in
              </Button>
            </form>
          </div>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-700">
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* New Google user: needs role selection */}
      <GoogleOnboardingModal
        isOpen={!!pendingOnboarding}
        onClose={() => {
          setPendingOnboarding(null);
          setPendingIdToken('');
        }}
        pendingData={pendingOnboarding}
        idToken={pendingIdToken}
      />
    </>
  );
}
