import { Link } from 'react-router-dom';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@aip/validation';
import { useRegister } from '@/hooks/mutations/useRegister';
import { useInstitutionsCatalog } from '@/hooks/queries/useInstitutionsCatalog';
import { buildRegisterPayload } from './registerPayload';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import RadioGroup from '@/components/ui/RadioGroup';
import Select from '@/components/ui/Select';

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
  const needsInstitution = role === 'STUDENT' || role === 'FACULTY';

  const institutionOptions =
    institutions.data?.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` })) ?? [];

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
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-block text-2xl font-bold text-indigo-600 no-underline mb-3"
          >
            AIP
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Create your account
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Join the Academia-Industry Portal today.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
          <form
            onSubmit={handleSubmit((data) =>
              // Built again rather than trusting the resolver's return value, so
              // the request body is the role's payload regardless of which object
              // react-hook-form hands back. `buildRegisterPayload` is pure and
              // idempotent, so running it twice costs nothing.
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
              onChange={(v) => setValue('role', v as PublicRole, { shouldValidate: true })}
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
                label="Institution"
                placeholder={
                  institutions.isLoading ? 'Loading institutions…' : 'Select your institution'
                }
                options={institutionOptions}
                error={errors.institutionId?.message ?? institutionNotice}
                helperText={
                  institutionsEmpty
                    ? 'No verified institutions are available yet. Ask an administrator to add and verify one before signing up.'
                    : undefined
                }
                disabled={institutions.isLoading}
                {...register('institutionId')}
              />
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
                  verification. An administrator will review and verify the institution before it
                  appears for students and faculty to select.
                </p>
                <Input
                  label="Institution name"
                  placeholder="Acme Institute of Technology"
                  error={errors.institutionName?.message}
                  {...register('institutionName')}
                />
                <Input
                  label="Institution code"
                  placeholder="IITBOM"
                  helperText="Uppercase letters and digits, 3–20 characters."
                  error={errors.institutionCode?.message}
                  {...register('institutionCode')}
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

            <Button type="submit" className="w-full" loading={register_.isPending}>
              Create account
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
  );
}
