import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { WORK_MODES } from '@aip/config';
import type { InternshipStatus, WorkMode } from '@aip/config';
import { objectIdSchema, type UpdateInternshipInput } from '@aip/validation';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import SkillPicker from '@/components/features/SkillPicker';
import BranchPicker from '@/components/features/BranchPicker';
import { useCompanyInternship, useUpdateInternship } from '@/hooks/queries/useCompanyInternships';

/** Empty number inputs yield '', which must become `undefined` — not NaN — before Zod sees it. */
const numberFromInput = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const textFromInput = (value: unknown) => {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  return trimmed === '' || trimmed === null ? undefined : trimmed;
};

const formSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().min(20).max(5000),
    location: z.string().min(1).max(200),
    workMode: z.enum(WORK_MODES as unknown as [WorkMode, ...WorkMode[]]),
    durationMonths: z
      .number({
        required_error: 'Duration is required.',
        invalid_type_error: 'Duration is required.',
      })
      .int()
      .min(1)
      .max(24),
    stipend: z.number().min(0).optional(),
    // The server requires exactly three characters, so `max(3)` let a 1- or
    // 2-letter code through the browser and come back as a 422.
    currency: z.string().length(3, 'Use a 3-letter code, e.g. INR').optional(),
    minCgpa: z.number().min(0).max(10).optional(),
    applicationDeadline: z.string().optional(),
    openings: z
      .number({ required_error: 'Openings is required.', invalid_type_error: 'Openings is required.' })
      .int()
      .min(1),
    requiredSkills: z.array(objectIdSchema).min(1, 'Select at least one required skill.'),
  })
  .superRefine((data, ctx) => {
    // Both cards fall back to '₹' when currency is absent, so a stipend saved
    // without one silently claims to be rupees.
    if (data.stipend !== undefined && data.currency === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currency'],
        message: 'Add the currency for this stipend, or leave the stipend empty.',
      });
    }
  });

type FormData = z.infer<typeof formSchema>;

const workModeOptions = WORK_MODES.map((m) => ({ value: m, label: m.charAt(0) + m.slice(1).toLowerCase() }));

export default function CompanyInternshipEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: internship, isLoading, isError, refetch } = useCompanyInternship(id!);
  const updateInternship = useUpdateInternship(id!);
  const [preferredSkills, setPreferredSkills] = useState<string[]>([]);
  const [eligibleBranches, setEligibleBranches] = useState<string[]>([]);
  const [gradYearInput, setGradYearInput] = useState('');
  const [eligibleGradYears, setEligibleGradYears] = useState<number[]>([]);

  const { register, control, reset, trigger, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (internship) {
      reset({
        title: internship.title,
        description: internship.description,
        location: internship.location,
        workMode: internship.workMode,
        durationMonths: internship.durationMonths,
        stipend: internship.stipend,
        currency: internship.currency,
        minCgpa: internship.minCgpa,
        applicationDeadline: internship.applicationDeadline?.slice(0, 10),
        openings: internship.openings,
        requiredSkills: internship.requiredSkills.map((s) => s.id),
      });
      setPreferredSkills(internship.preferredSkills.map((s) => s.id));
      setEligibleBranches(internship.eligibleBranches);
      setEligibleGradYears(internship.eligibleGradYears);
    }
  }, [internship, reset]);

  function addGradYear() {
    const y = parseInt(gradYearInput, 10);
    if (!isNaN(y) && y >= 1950 && y <= 2100 && !eligibleGradYears.includes(y)) {
      setEligibleGradYears((prev) => [...prev, y]);
    }
    setGradYearInput('');
  }

  async function submit(status: InternshipStatus) {
    const valid = await trigger();
    if (!valid) return;
    const data = getValues();
    const payload: UpdateInternshipInput = {
      title: data.title,
      description: data.description,
      location: data.location,
      workMode: data.workMode,
      durationMonths: data.durationMonths,
      stipend: data.stipend,
      currency: data.currency,
      minCgpa: data.minCgpa,
      eligibleBranches,
      eligibleGradYears,
      requiredSkills: data.requiredSkills,
      preferredSkills,
      applicationDeadline: data.applicationDeadline
        ? new Date(data.applicationDeadline).toISOString()
        : undefined,
      openings: data.openings,
      status,
    };
    updateInternship.mutate(payload, { onSuccess: () => navigate('/company/internships/manage') });
  }

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Edit Internship" subtitle="Update this internship listing's details." />

      {isLoading ? (
        <SkeletonCard className="h-96" />
      ) : (
        <form className="space-y-6 max-w-3xl" onSubmit={(e) => e.preventDefault()}>
          <Card>
            <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Basic Details</h3></Card.Header>
            <Card.Body className="space-y-4">
              <Input label="Internship Title" error={errors.title?.message} {...register('title')} />
              <Textarea label="Description" rows={6} error={errors.description?.message} {...register('description')} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Location" error={errors.location?.message} {...register('location')} />
                <Select label="Work Mode" options={workModeOptions} error={errors.workMode?.message} {...register('workMode')} />
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Duration & Stipend</h3></Card.Header>
            <Card.Body className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Input label="Duration (months)" type="number" min={1} max={24} error={errors.durationMonths?.message} {...register('durationMonths', { setValueAs: numberFromInput })} />
                <Input label="Stipend" type="number" min={0} error={errors.stipend?.message} {...register('stipend', { setValueAs: numberFromInput })} />
                <Input label="Currency (3-letter)" placeholder="INR" maxLength={3} error={errors.currency?.message} {...register('currency', { setValueAs: textFromInput })} />
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Eligibility</h3></Card.Header>
            <Card.Body className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Min CGPA" type="number" step="0.1" min={0} max={10} error={errors.minCgpa?.message} {...register('minCgpa', { setValueAs: numberFromInput })} />
                <Input label="Openings" type="number" min={1} error={errors.openings?.message} {...register('openings', { setValueAs: numberFromInput })} />
              </div>
              <BranchPicker label="Eligible Branches" value={eligibleBranches} onChange={setEligibleBranches} />
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1.5">Eligible Graduation Years</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {eligibleGradYears.map((y) => (
                    <span key={y} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800">
                      {y}
                      <button type="button" onClick={() => setEligibleGradYears((p) => p.filter((v) => v !== y))}>×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="e.g. 2025" value={gradYearInput} onChange={(e) => setGradYearInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGradYear(); } }} />
                  <Button type="button" variant="outline" size="sm" onClick={addGradYear}>Add</Button>
                </div>
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Skills</h3></Card.Header>
            <Card.Body className="space-y-4">
              <Controller
                name="requiredSkills"
                control={control}
                render={({ field, fieldState }) => (
                  <SkillPicker
                    label="Required Skills"
                    value={field.value ?? []}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <SkillPicker label="Preferred Skills" value={preferredSkills} onChange={setPreferredSkills} />
            </Card.Body>
          </Card>

          <Card>
            <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Deadline</h3></Card.Header>
            <Card.Body>
              <Input label="Application Deadline" type="date" error={errors.applicationDeadline?.message} {...register('applicationDeadline')} />
            </Card.Body>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/company/internships/manage')}>Cancel</Button>
            <Button type="button" variant="secondary" loading={updateInternship.isPending} onClick={() => submit('DRAFT')}>Save as Draft</Button>
            <Button type="button" loading={updateInternship.isPending} onClick={() => submit('PUBLISHED')}>Publish</Button>
          </div>
        </form>
      )}
    </div>
  );
}
