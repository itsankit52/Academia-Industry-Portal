import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@aip/validation';
import { useRegister } from '@/hooks/mutations/useRegister';
import {
  useGoogleAuth,
  type OnboardingResponse,
  type EmailConflictResponse,
} from '@/hooks/mutations/useGoogleAuth';
import { useInstitutionsCatalog } from '@/hooks/queries/useInstitutionsCatalog';
import { useVerifyInstitutionCode } from '@/hooks/queries/useVerifyInstitutionCode';
import { buildRegisterPayload } from './registerPayload';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import RadioGroup from '@/components/ui/RadioGroup';
import Select from '@/components/ui/Select';
import Logo from '@/components/ui/Logo';
import GoogleSignInButton from '@/components/ui/GoogleSignInButton';
import GoogleOnboardingModal from '@/components/features/GoogleOnboardingModal';
import { FiCheck, FiX } from 'react-icons/fi';

type PublicRole = 'STUDENT' | 'COMPANY' | 'FACULTY' | 'INSTITUTION';

const roleOptions: Array<{ value: PublicRole; label: string }> = [
  { value: 'STUDENT', label: 'Student — find jobs & internships' },
  { value: 'COMPANY', label: 'Company — post opportunities & hire' },
  { value: 'FACULTY', label: 'Faculty — mentor students & collaborate' },
  {
    value: 'INSTITUTION',
    label: 'Institution Admin — manage students, faculty & industry',
  },
];

const schemaResolver = zodResolver(registerSchema) as Resolver<RegisterInput>;

/**
 * Validate the payload that will actually be sent, not the raw form state. The
 * raw state retains values from fields the current role no longer renders (see
 * `buildRegisterPayload`), and validating those produced errors with nowhere to
 * display — a submit button that silently did nothing.
 */
const registerResolver: Resolver<RegisterInput> = (values, context, options) =>
  schemaResolver(buildRegisterPayload(values) as RegisterInput, context, options);

export default function Register() {
  const register_ = useRegister();
  const institutions = useInstitutionsCatalog();
  const {
    verificationState,
    isVerifying,
    error: verifyError,
    verifyCode,
    reset: resetVerification,
  } = useVerifyInstitutionCode();

  // Google auth state
  const [pendingOnboarding, setPendingOnboarding] = useState<OnboardingResponse | null>(null);
  const [pendingIdToken, setPendingIdToken] = useState('');
  const [emailConflict, setEmailConflict] = useState<EmailConflictResponse | null>(null);

  const googleAuth = useGoogleAuth({
    onNeedsOnboarding: (data) => {
      setPendingOnboarding(data);
    },
    onEmailConflict: (data) => {
      setEmailConflict(data);
    },
  });

  const handleGoogleToken = (idToken: string) => {
    setPendingIdToken(idToken);
    setEmailConflict(null);
    googleAuth.mutate({ idToken });
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: registerResolver,
    defaultValues: {
      role: 'STUDENT',
      designation: 'Assistant Professor',
      department: 'General',
    },
  });

  const role = watch('role') as PublicRole;
  const institutionId = watch('institutionId');
  const institutionCode = watch('institutionCode');
  const needsInstitution = role === 'STUDENT' || role === 'FACULTY';
  const isStudent = role === 'STUDENT';

  // Reset verification whenever the institution selection or code changes.
  useEffect(() => {
    resetVerification();
  }, [institutionId, institutionCode, resetVerification]);

  const institutionOptions = institutions.data?.map((i) => ({ value: i.id, label: i.name })) ?? [];

  const handleVerifyInstitution = async () => {
    if (!institutionId || !institutionCode) return;
    await verifyCode(institutionCode, institutionId);
  };

  const isVerified =
    isStudent &&
    verificationState?.valid === true &&
    verificationState?.institution?.id === institutionId;

  /**
   * A select holding nothing but its placeholder used to mean three different
   * things — still loading, the request failed, or the catalogue is genuinely
   * empty — and the form showed the same thing for all three. `institutions.
   * isError` was never read, so an unreachable API read as "there are no
   * institutions", and an empty catalogue read as nothing at all. Since
   * `institutionId` is required for STUDENT and FACULTY, that left signup stuck
   * on a field with no valid value and no explanation.
   */
  const institutionsEmpty = institutions.isSuccess && institutionOptions.length === 0;
  const institutionNotice = institutions.isError
    ? `Could not load the institution list: ${institutions.error.message} Reload the page to try again.`
    : undefined;

  return (
    <>
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block no-underline mb-3">
              <Logo className="h-8" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Create your account
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              Join the AcadIn today.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
            {/* Quick Google sign-up */}
            <div className="mb-5">
              <GoogleSignInButton
                onToken={handleGoogleToken}
                disabled={googleAuth.isPending || register_.isPending}
                text="signup_with"
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
                  <p className="mt-0.5 text-xs">
                    {emailConflict.message}{' '}
                    <Link to="/login" className="font-medium underline">
                      Sign in instead
                    </Link>
                  </p>
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
                  or sign up with email
                </span>
              </div>
            </div>

            <form
              onSubmit={handleSubmit((data) =>
                register_.mutate(buildRegisterPayload(data) as RegisterInput),
              )}
              noValidate
              className="space-y-5"
            >
              <RadioGroup
                label="I am a…"
                name="role"
                options={roleOptions}
                value={role}
                onChange={(v) => {
                  setValue('role', v as PublicRole, { shouldValidate: true });
                  resetVerification();
                }}
                error={errors.role?.message}
              />

              {(role === 'STUDENT' || role === 'FACULTY') && (
                <Input
                  label="Full name"
                  placeholder="Jane Smith"
                  autoComplete="name"
                  error={errors.fullName?.message}
                  {...register('fullName')}
                />
              )}

              {role === 'COMPANY' && (
                <Input
                  label="Company name"
                  placeholder="Acme Corp"
                  error={errors.companyName?.message}
                  {...register('companyName')}
                />
              )}

              {needsInstitution && (
                <Select
                  label="University / Institution"
                  required
                  placeholder={
                    institutions.isLoading
                      ? 'Loading institutions…'
                      : 'Select your university / institution'
                  }
                  options={institutionOptions}
                  error={errors.institutionId?.message ?? institutionNotice}
                  helperText={
                    institutionsEmpty
                      ? 'No verified institutions are currently available. Please contact your institution administrator to register your institution first.'
                      : undefined
                  }
                  disabled={institutions.isLoading}
                  {...register('institutionId')}
                />
              )}

              {/* Institution code — required for STUDENT registration */}
              {isStudent && (
                <>
                  <div>
                    <Input
                      label="Institution code"
                      placeholder="e.g. AB12345"
                      required
                      helperText="Obtain this code from your institution administrator."
                      error={errors.institutionCode?.message ?? verifyError ?? undefined}
                      {...register('institutionCode')}
                    />
                  </div>

                  {/* Verify button */}
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      loading={isVerifying}
                      disabled={!institutionId || !institutionCode?.trim()}
                      onClick={handleVerifyInstitution}
                    >
                      {isVerifying ? 'Verifying…' : 'Verify institution code'}
                    </Button>
                  </div>

                  {/* Verification result */}
                  {isVerified && verificationState?.institution && (
                    <div className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                      <FiCheck className="mt-0.5 shrink-0" />
                      <span>
                        Institution verified:{' '}
                        <span className="font-medium">{verificationState.institution.name}</span>
                      </span>
                    </div>
                  )}

                  {/* Invalid code */}
                  {verificationState?.valid === false && (
                    <div className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
                      <FiX className="mt-0.5 shrink-0" />
                      <span>
                        {verifyError ??
                          'The institution code is invalid or does not match the selected institution.'}
                      </span>
                    </div>
                  )}
                </>
              )}

              {role === 'FACULTY' && (
                <>
                  <Input
                    label="Designation"
                    placeholder="Assistant Professor"
                    error={errors.designation?.message}
                    {...register('designation')}
                  />
                  <Input
                    label="Department"
                    placeholder="Computer Science"
                    error={errors.department?.message}
                    {...register('department')}
                  />
                </>
              )}

              {role === 'INSTITUTION' && (
                <>
                  <p
                    className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2"
                    role="note"
                  >
                    Your institution will be created with{' '}
                    <span className="font-medium">PENDING</span> verification. A unique institution
                    code will be generated automatically. An administrator will review and verify
                    the institution before it appears for students and faculty to select.
                  </p>
                  <Input
                    label="Institution name"
                    placeholder="Acme Institute of Technology"
                    error={errors.institutionName?.message}
                    {...register('institutionName')}
                  />
                  <Input
                    label="Primary email domain"
                    placeholder="acme.edu"
                    helperText="e.g. the domain used by your students' email addresses."
                    error={errors.institutionDomain?.message}
                    {...register('institutionDomain')}
                  />
                  <Input
                    label="Address"
                    placeholder="123, Main Road"
                    error={errors.institutionAddress?.message}
                    {...register('institutionAddress')}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="City"
                      placeholder="Mumbai"
                      error={errors.institutionCity?.message}
                      {...register('institutionCity')}
                    />
                    <Input
                      label="State"
                      placeholder="Maharashtra"
                      error={errors.institutionState?.message}
                      {...register('institutionState')}
                    />
                  </div>
                </>
              )}

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
                placeholder="At least 8 characters"
                autoComplete="new-password"
                error={errors.password?.message}
                {...register('password')}
              />

              {register_.error && (
                <p
                  className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2"
                  role="alert"
                >
                  {register_.error.message}
                </p>
              )}

              {/* Disable submit for students until institution is verified */}
              <Button
                type="submit"
                className="w-full"
                loading={register_.isPending}
                disabled={isStudent && !isVerified}
              >
                {isStudent && !isVerified && verificationState !== null
                  ? 'Verify institution to continue'
                  : 'Create account'}
              </Button>
            </form>
          </div>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Google onboarding modal */}
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
