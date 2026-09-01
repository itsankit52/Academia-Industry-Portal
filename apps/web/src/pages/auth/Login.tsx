import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@aip/validation';
import { useLogin } from '@/hooks/mutations/useLogin';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Logo from '@/components/ui/Logo';

const DEMO_ACCOUNTS = [
  {
    role: 'Student',
    email: 'arya@demo.edu',
    hint: 'Arya Sharma — has skills, placements, assessments',
  },
  {
    role: 'Company',
    email: 'hr@demotech.demo',
    hint: 'Demo Technologies — has jobs, applications',
  },
  { role: 'Faculty', email: 'dr.sharma@demo.edu', hint: 'Dr. Sharma — has events, placements' },
  {
    role: 'Institution',
    email: 'registrar@demo.edu',
    hint: 'Demo Institute of Technology — full dashboard',
  },
  { role: 'Admin', email: 'admin@aip.demo', hint: 'Platform administrator' },
] as const;

const DEMO_PASSWORD = 'Demo@1234';

export default function Login() {
  const login = useLogin();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const emailValue = watch('email') ?? '';

  function fillDemo(email: string) {
    setValue('email', email, { shouldValidate: true });
    setValue('password', DEMO_PASSWORD);
  }

  return (
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

        {/* Demo accounts — shown only when email field is empty */}
        <div className="mb-6">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
            Demo Accounts (password:{' '}
            <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">Demo@1234</code>
            )
          </p>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillDemo(acc.email)}
                className={`
                  w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors
                  ${
                    emailValue === acc.email
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                  }
                `}
              >
                <span className="font-medium text-slate-900 dark:text-slate-100">{acc.role}</span>
                <span className="text-slate-500 dark:text-slate-400 ml-2 text-xs">{acc.email}</span>
                <span className="hidden sm:inline text-slate-400 dark:text-slate-500 text-xs ml-2">
                  — {acc.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
          <form
            onSubmit={handleSubmit((data) => login.mutate(data))}
            noValidate
            className="space-y-5"
          >
            <Input
              label="Email address"
              type="email"
              placeholder="arya@demo.edu"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <div>
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register('password')}
              />
            </div>

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
  );
}
