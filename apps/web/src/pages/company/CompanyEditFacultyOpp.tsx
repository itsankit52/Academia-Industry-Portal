import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FiPlus, FiX } from 'react-icons/fi';
import { WORK_MODES } from '@aip/config';
import type { WorkMode } from '@aip/config';
import {
  FACULTY_OPPORTUNITY_TYPES,
  FACULTY_OPP_TARGET_ROLES,
  type FacultyOpportunityType,
  type FacultyOppTargetRole,
  type UpdateFacultyOpportunityInput,
} from '@aip/validation';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  useFacultyOpportunity,
  useUpdateFacultyOpportunity,
} from '@/hooks/queries/useFacultyOpportunities';

const typeOptions = FACULTY_OPPORTUNITY_TYPES.map((t) => ({
  value: t,
  label: t.replace(/_/g, ' ').replace(/(\b\w)/g, (c) => c.toUpperCase()),
}));

const modeOptions = WORK_MODES.map((m) => ({ value: m, label: m.charAt(0) + m.slice(1).toLowerCase() }));

const formSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(20).max(10000),
  opportunityType: z.enum(
    FACULTY_OPPORTUNITY_TYPES as unknown as [FacultyOpportunityType, ...FacultyOpportunityType[]],
  ),
  location: z.string().min(1).max(200),
  mode: z.enum(WORK_MODES as unknown as [WorkMode, ...WorkMode[]]),
  applicationDeadline: z.string().min(1),
  openings: z.coerce.number().int().min(1),
  durationWeeks: z.coerce.number().int().min(1).max(260).optional(),
  stipendAmount: z.coerce.number().min(0).optional(),
  stipendCurrency: z.string().max(6).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ChipInputProps {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

function ChipInput({ label, values, onChange, placeholder }: ChipInputProps) {
  const [text, setText] = useState('');

  function add() {
    const trimmed = text.trim();
    if (!trimmed || values.includes(trimmed)) {
      setText('');
      return;
    }
    onChange([...values, trimmed]);
    setText('');
  }

  return (
    <div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="hover:text-rose-500"
              aria-label={`Remove ${v}`}
            >
              <FiX className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          iconLeft={<FiPlus className="w-4 h-4" />}
          onClick={add}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function toDateInput(iso?: string) {
  if (!iso) return '';
  return iso.split('T')[0];
}

export default function CompanyEditFacultyOpp() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: opp, isLoading, isError, refetch } = useFacultyOpportunity(id ?? '');
  const update = useUpdateFacultyOpportunity(id ?? '');

  const [requiredExpertise, setRequiredExpertise] = useState<string[]>([]);
  const [preferredQualifications, setPreferredQualifications] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<FacultyOppTargetRole[]>([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (!opp) return;
    reset({
      title: opp.title,
      description: opp.description,
      opportunityType: opp.opportunityType,
      location: opp.location,
      mode: opp.mode,
      applicationDeadline: toDateInput(opp.applicationDeadline),
      openings: opp.openings,
      durationWeeks: opp.durationWeeks,
      stipendAmount: opp.stipend?.amount,
      stipendCurrency: opp.stipend?.currency ?? 'INR',
    });
    setRequiredExpertise(opp.requiredExpertise ?? []);
    setPreferredQualifications(opp.preferredQualifications ?? []);
    setTargetRoles(opp.targetRoles ?? []);
  }, [opp, reset]);

  function toggleRole(role: FacultyOppTargetRole) {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  function onSubmit(data: FormValues) {
    const stipend =
      data.stipendAmount !== undefined
        ? { amount: data.stipendAmount, currency: data.stipendCurrency || 'INR' }
        : undefined;
    const payload: UpdateFacultyOpportunityInput = {
      title: data.title,
      description: data.description,
      opportunityType: data.opportunityType,
      requiredExpertise,
      preferredQualifications,
      location: data.location,
      mode: data.mode,
      applicationDeadline: new Date(data.applicationDeadline).toISOString(),
      openings: data.openings,
      targetRoles,
      ...(data.durationWeeks !== undefined ? { durationWeeks: data.durationWeeks } : {}),
      ...(stipend ? { stipend } : {}),
    };
    update.mutate(payload, {
      onSuccess: () => navigate('/company/faculty-opportunities'),
    });
  }

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError || !opp) {
    return (
      <div className="container-page py-8">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Edit Faculty Opportunity" subtitle={opp.title} />

      <form className="space-y-6 max-w-3xl" onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <Card.Header>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Basics</h3>
          </Card.Header>
          <Card.Body className="space-y-4">
            <Input label="Title" error={errors.title?.message} {...register('title')} />
            <Textarea label="Description" rows={6} error={errors.description?.message} {...register('description')} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select label="Type" options={typeOptions} error={errors.opportunityType?.message} {...register('opportunityType')} />
              <Select label="Mode" options={modeOptions} error={errors.mode?.message} {...register('mode')} />
              <Input label="Location" error={errors.location?.message} {...register('location')} />
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Requirements</h3>
          </Card.Header>
          <Card.Body className="space-y-4">
            <ChipInput label="Required Expertise" values={requiredExpertise} onChange={setRequiredExpertise} />
            <ChipInput
              label="Preferred Qualifications"
              values={preferredQualifications}
              onChange={setPreferredQualifications}
            />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Target Roles</p>
              <div className="flex gap-4">
                {FACULTY_OPP_TARGET_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={targetRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{role}</span>
                  </label>
                ))}
              </div>
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Logistics</h3>
          </Card.Header>
          <Card.Body className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Openings" type="number" min={1} error={errors.openings?.message} {...register('openings', { valueAsNumber: true })} />
              <Input label="Duration (weeks)" type="number" min={1} max={260} error={errors.durationWeeks?.message} {...register('durationWeeks', { valueAsNumber: true })} />
            </div>
            <Input label="Application Deadline" type="date" error={errors.applicationDeadline?.message} {...register('applicationDeadline')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Stipend Amount" type="number" min={0} error={errors.stipendAmount?.message} {...register('stipendAmount', { valueAsNumber: true })} />
              <Input label="Currency" maxLength={6} error={errors.stipendCurrency?.message} {...register('stipendCurrency')} />
            </div>
          </Card.Body>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/company/faculty-opportunities')}>
            Cancel
          </Button>
          <Button type="submit" loading={update.isPending}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
