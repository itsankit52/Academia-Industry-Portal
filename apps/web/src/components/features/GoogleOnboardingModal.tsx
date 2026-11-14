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

import { useEffect, useMemo, useRef } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  googleOnboardingSchema,
  type GoogleAuthInput,
  type GoogleOnboardingInput,
} from '@aip/validation';
import type { OnboardingResponse } from '@/hooks/mutations/useGoogleAuth';
import { useGoogleAuth } from '@/hooks/mutations/useGoogleAuth';
import { useInstitutionsCatalog } from '@/hooks/queries/useInstitutionsCatalog';
import { useVerifyInstitutionCode } from '@/hooks/queries/useVerifyInstitutionCode';
import { ApiClientError } from '@/lib/ApiClientError';
import {
  buildGoogleOnboardingPayload,
  type GoogleOnboardingFormValues,
} from '@/pages/auth/registerPayload';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import RadioGroup from '@/components/ui/RadioGroup';
import Select from '@/components/ui/Select';
import { FiCheck, FiX } from 'react-icons/fi';

// ── Form schema ───────────────────────────────────────────────────────────────
//
// The schema is the shared `googleOnboardingSchema` — the same role rules the
// backend applies to POST /auth/google. It validates the payload that will be
// sent, not the raw form state: react-hook-form keeps values of fields the
// current role no longer renders (the STUDENT branch mounts first, leaving
// `fullName: ''` and `institutionCode: ''` behind), and validating those used
// to fail on invisible fields, so "Create account" silently did nothing for
// COMPANY, FACULTY and INSTITUTION.

type OnboardingFormValues = GoogleOnboardingInput;
type PublicRole = GoogleOnboardingInput['role'];

const schemaResolver = zodResolver(googleOnboardingSchema) as Resolver<OnboardingFormValues>;

const FORM_FIELDS = new Set<string>([
  'role',
  'fullName',
  'companyName',
  'institutionId',
  'institutionCode',
  'institutionName',
  'institutionDomain',
  'institutionAddress',
  'institutionCity',
  'institutionState',
  'designation',
  'department',
]);

const roleOptions: Array<{ value: PublicRole; label: string }> = [
  { value: 'STUDENT', label: 'Student — find jobs & internships' },
  { value: 'COMPANY', label: 'Company — post opportunities & hire' },
  { value: 'FACULTY', label: 'Faculty — mentor students & collaborate' },
  { value: 'INSTITUTION', label: 'Institution Admin — manage students & industry' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface GoogleOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Data returned by the backend when it reports requiresOnboarding: true */
  pendingData: OnboardingResponse | null;
  /** Original ID token to re-send with the role selection */
  idToken: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GoogleOnboardingModal({
  isOpen,
  onClose,
  pendingData,
  idToken,
}: GoogleOnboardingModalProps) {
  // This internal mutation handles the SECOND call (with role + profile data).
  // onNeedsOnboarding is intentionally not wired — if the backend somehow
  // returns needs_role again the error path below catches it.
  const googleAuth = useGoogleAuth();

  const institutions = useInstitutionsCatalog();
  const {
    verificationState,
    isVerifying,
    error: verifyError,
    verifyCode,
    reset: resetVerification,
  } = useVerifyInstitutionCode();

  // Read through a ref so the resolver identity stays stable across renders.
  const googleNameRef = useRef<string | undefined>(pendingData?.name);
  googleNameRef.current = pendingData?.name;

  const onboardingResolver = useMemo<Resolver<OnboardingFormValues>>(
    () => (values, context, options) =>
      schemaResolver(
        buildGoogleOnboardingPayload(
          values as GoogleOnboardingFormValues,
          googleNameRef.current,
        ) as OnboardingFormValues,
        context,
        options,
      ),
    [],
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    reset: resetForm,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingFormValues>({
    resolver: onboardingResolver,
    defaultValues: { role: 'STUDENT', designation: 'Assistant Professor', department: 'General' },
  });

  // In flight, or already succeeded and navigating away: no second submit.
  const busy = isSubmitting || googleAuth.isPending || googleAuth.isSuccess;

  // Reset everything when the modal is closed or reopened with new data.
  useEffect(() => {
    if (!isOpen) {
      resetForm({ role: 'STUDENT', designation: 'Assistant Professor', department: 'General' });
      resetVerification();
    }
  }, [isOpen, resetForm, resetVerification]);

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

  // `values` is the resolver's output: already narrowed to the chosen role,
  // trimmed, blanks dropped, and validated against googleOnboardingSchema.
  const onSubmit = async (values: OnboardingFormValues) => {
    if (busy) return;
    if (!idToken) {
      toast.error('Session expired. Please sign in with Google again.');
      onClose();
      return;
    }
    const payload: GoogleAuthInput = { idToken, ...values };
    try {
      await googleAuth.mutateAsync(payload);
    } catch (err) {
      // The banner below shows the message; also pin any field-level server
      // errors (e.g. a 422 on institutionDomain) to the input they belong to.
      if (err instanceof ApiClientError) {
        for (const detail of err.details ?? []) {
          if (detail.path && FORM_FIELDS.has(detail.path)) {
            setError(detail.path as keyof OnboardingFormValues, { message: detail.message });
          }
        }
      }
    }
  };

  // The only way out is the explicit × ("Cancel Google sign-up"): a stray
  // backdrop click or Escape would discard everything typed, and closing also
  // drops the Google token, so the user would have to start over. Dismissing
  // mid-request would orphan the in-flight signup's UI, so × is disabled then.
  const handleClose = () => {
    if (!busy) onClose();
  };

  return (
    // Use the 'lg' size so the form has room to breathe and doesn't overflow on
    // mobile. The Modal panel itself is scrollable via the className override.
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Complete your profile"
      size="md"
      closeOnBackdrop={false}
      closeOnEscape={false}
      closeLabel="Cancel Google sign-up"
      closeDisabled={busy}
      // Allow the panel to scroll when content is taller than the viewport.
      // This keeps all inputs inside the scrollable panel (not a nested div)
      // so there is no inner stacking context that could block pointer events.
      className="overflow-y-auto max-h-[90vh]"
    >
      {/* Inner padding wrapper — no overflow or max-height here so there is
          only ONE scroll container: the Modal panel itself. Having two nested
          overflow-y-auto containers was creating a sub-stacking context that
          swallowed pointer events on form controls rendered below the fold. */}
      <div className="p-6">
        {/* Welcome header */}
        <div className="mb-5 text-center">
          {pendingData?.picture && (
            <img
              src={pendingData.picture}
              alt="Your Google profile photo"
              className="w-14 h-14 rounded-full mx-auto mb-3 border border-slate-200 dark:border-slate-700"
            />
          )}
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Welcome, <span className="font-medium">{pendingData?.name ?? pendingData?.email}</span>!
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-0.5">
            Choose how you&apos;d like to use AcadIn.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Disabling the fieldset locks every control while the request is
              in flight; `space-y-4` keeps the original vertical rhythm. */}
          <fieldset disabled={busy} className="space-y-4">
            {/* Role selection */}
            <RadioGroup
              label="I am a…"
              name="role"
              options={roleOptions}
              value={role}
              onChange={(v) => {
                // Errors from the previous role belong to fields that are about
                // to unmount; drop them so none linger invisibly.
                clearErrors();
                setValue('role', v as PublicRole);
                resetVerification();
              }}
              error={errors.role?.message}
            />

            {/* Full name — STUDENT / FACULTY */}
            {(role === 'STUDENT' || role === 'FACULTY') && (
              <Input
                label="Full name"
                placeholder={pendingData?.name ?? 'Jane Smith'}
                autoComplete="name"
                helperText={
                  pendingData?.name ? 'Leave blank to use your Google account name.' : undefined
                }
                error={errors.fullName?.message}
                {...register('fullName')}
              />
            )}

            {/* Company name — COMPANY */}
            {role === 'COMPANY' && (
              <Input
                label="Company name"
                placeholder="Acme Corp"
                error={errors.companyName?.message}
                {...register('companyName')}
              />
            )}

            {/* Institution select — STUDENT / FACULTY */}
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

            {/* Institution code + verify — STUDENT only */}
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

            {/* Designation / Department — FACULTY */}
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

            {/* Institution details — INSTITUTION role */}
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

            {/* Submission error */}
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
              loading={busy}
              disabled={isStudent && !isVerified}
            >
              {isStudent && !isVerified && verificationState !== null
                ? 'Verify institution to continue'
                : 'Create account'}
            </Button>
            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
              Your account is created only when you select Create account. Closing this window (×)
              cancels Google sign-up and discards what you entered.
            </p>
          </fieldset>
        </form>
      </div>
    </Modal>
  );
}
