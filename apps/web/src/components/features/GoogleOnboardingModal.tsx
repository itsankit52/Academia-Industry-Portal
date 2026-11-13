/**
 * GoogleOnboardingModal
 *
 * Shown when a new Google user authenticates for the first time and needs to
 * select an AcadIn role + supply the required profile fields for that role.
 *
 * The form re-uses the same role options and role-specific fields as Register.tsx,
 * but instead of sending email+password, it sends the original Google ID token
 * plus the chosen role and profile details.
 *
 * Security: the idToken is kept only in component state (never persisted) and
 * is sent directly to the backend for server-side verification on each attempt.
 */

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { GoogleAuthInput } from '@aip/validation';
import type { OnboardingResponse } from '@/hooks/mutations/useGoogleAuth';
import { useGoogleAuth } from '@/hooks/mutations/useGoogleAuth';
import { useInstitutionsCatalog } from '@/hooks/queries/useInstitutionsCatalog';
import { useVerifyInstitutionCode } from '@/hooks/queries/useVerifyInstitutionCode';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import RadioGroup from '@/components/ui/RadioGroup';
import Select from '@/components/ui/Select';
import { FiCheck, FiX } from 'react-icons/fi';

// ── Form schema (role-specific sub-fields are optional — validated in service) ──

const onboardingSchema = z.object({
  role: z.enum(['STUDENT', 'COMPANY', 'FACULTY', 'INSTITUTION']),
  fullName: z.string().min(1).max(120).optional(),
  companyName: z.string().min(1).max(200).optional(),
  institutionId: z.string().optional(),
  institutionCode: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Z0-9]+$/, 'Code must be uppercase letters and digits only')
    .optional(),
  institutionName: z.string().min(2).max(200).optional(),
  institutionDomain: z.string().min(4).max(120).optional(),
  institutionAddress: z.string().min(1).max(500).optional(),
  institutionCity: z.string().min(1).max(120).optional(),
  institutionState: z.string().min(1).max(120).optional(),
  designation: z.string().min(1).max(120).optional(),
  department: z.string().min(1).max(120).optional(),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;
type PublicRole = 'STUDENT' | 'COMPANY' | 'FACULTY' | 'INSTITUTION';

const roleOptions: Array<{ value: PublicRole; label: string }> = [
  { value: 'STUDENT', label: 'Student — find jobs & internships' },
  { value: 'COMPANY', label: 'Company — post opportunities & hire' },
  { value: 'FACULTY', label: 'Faculty — mentor students & collaborate' },
  { value: 'INSTITUTION', label: 'Institution Admin — manage students & industry' },
];

// ── Props ────────────────────────────────────────────────────────────────────

interface GoogleOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Data returned by the backend when it reports requiresOnboarding: true */
  pendingData: OnboardingResponse | null;
  /** Original ID token to re-send with the role selection */
  idToken: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function GoogleOnboardingModal({
  isOpen,
  onClose,
  pendingData,
  idToken,
}: GoogleOnboardingModalProps) {
  const googleAuth = useGoogleAuth();
  const institutions = useInstitutionsCatalog();
  const {
    verificationState,
    isVerifying,
    error: verifyError,
    verifyCode,
    reset: resetVerification,
  } = useVerifyInstitutionCode();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema) as Resolver<OnboardingFormValues>,
    defaultValues: { role: 'STUDENT', designation: 'Assistant Professor', department: 'General' },
  });

  const role = watch('role') as PublicRole;
  const institutionId = watch('institutionId');
  const institutionCode = watch('institutionCode');

  useEffect(() => {
    resetVerification();
  }, [institutionId, institutionCode, resetVerification]);

  const isStudent = role === 'STUDENT';
  const needsInstitution = role === 'STUDENT' || role === 'FACULTY';
  const institutionOptions = institutions.data?.map((i) => ({ value: i.id, label: i.name })) ?? [];

  const isVerified =
    isStudent &&
    verificationState?.valid === true &&
    verificationState?.institution?.id === institutionId;

  const handleVerify = async () => {
    if (!institutionId || !institutionCode) return;
    await verifyCode(institutionCode, institutionId);
  };

  const onSubmit = (values: OnboardingFormValues) => {
    if (!idToken) {
      toast.error('Session expired. Please sign in with Google again.');
      onClose();
      return;
    }
    const payload: GoogleAuthInput = {
      idToken,
      role: values.role,
      fullName: values.fullName?.trim() || pendingData?.name,
      companyName: values.companyName?.trim(),
      institutionId: values.institutionId,
      institutionCode: values.institutionCode,
      institutionName: values.institutionName?.trim(),
      institutionDomain: values.institutionDomain?.trim(),
      institutionAddress: values.institutionAddress?.trim(),
      institutionCity: values.institutionCity?.trim(),
      institutionState: values.institutionState?.trim(),
      designation: values.designation?.trim(),
      department: values.department?.trim(),
    };
    googleAuth.mutate(payload);
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Complete your profile" size="md">
      <div className="p-6 overflow-y-auto max-h-[80vh] space-y-1">
        <div className="space-y-1 mb-5">
          {pendingData?.picture && (
            <img
              src={pendingData.picture}
              alt="Your Google profile photo"
              className="w-14 h-14 rounded-full mx-auto mb-3 border border-slate-200 dark:border-slate-700"
            />
          )}
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
            Welcome, <span className="font-medium">{pendingData?.name ?? pendingData?.email}</span>!
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500 text-center">
            Choose how you&apos;d like to use AcadIn.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
              placeholder={pendingData?.name ?? 'Jane Smith'}
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
                institutions.isLoading ? 'Loading institutions…' : 'Select your institution'
              }
              options={institutionOptions}
              error={errors.institutionId?.message}
              disabled={institutions.isLoading}
              {...register('institutionId')}
            />
          )}

          {isStudent && (
            <>
              <Input
                label="Institution code"
                placeholder="e.g. AB12345"
                required
                helperText="Obtain this code from your institution administrator."
                error={errors.institutionCode?.message ?? verifyError ?? undefined}
                {...register('institutionCode')}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                loading={isVerifying}
                disabled={!institutionId || !institutionCode?.trim()}
                onClick={handleVerify}
              >
                {isVerifying ? 'Verifying…' : 'Verify institution code'}
              </Button>
              {isVerified && verificationState?.institution && (
                <div className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                  <FiCheck className="mt-0.5 shrink-0" />
                  <span>
                    Institution verified:{' '}
                    <span className="font-medium">{verificationState.institution.name}</span>
                  </span>
                </div>
              )}
              {verificationState?.valid === false && (
                <div className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
                  <FiX className="mt-0.5 shrink-0" />
                  <span>{verifyError ?? 'Invalid institution code.'}</span>
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
                Your institution will be created with <span className="font-medium">PENDING</span>{' '}
                verification.
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

          {googleAuth.error && (
            <p
              className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2"
              role="alert"
            >
              {googleAuth.error.message}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            loading={googleAuth.isPending}
            disabled={isStudent && !isVerified}
          >
            {isStudent && !isVerified && verificationState !== null
              ? 'Verify institution to continue'
              : 'Create account'}
          </Button>
        </form>
      </div>
    </Modal>
  );
}
