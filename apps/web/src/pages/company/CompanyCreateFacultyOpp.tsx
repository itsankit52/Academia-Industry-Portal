import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FiPlus, FiX } from 'react-icons/fi';
import { WORK_MODES } from '@aip/config';
import type { WorkMode } from '@aip/config';
import {
  FACULTY_OPPORTUNITY_TYPES,
  FACULTY_OPP_TARGET_ROLES,
  type CreateFacultyOpportunityInput,
  type FacultyOpportunityType,
  type FacultyOppTargetRole,
} from '@aip/validation';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { useCreateFacultyOpportunity } from '@/hooks/queries/useFacultyOpportunities';

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

function defaultTargetsFor(type: FacultyOpportunityType): FacultyOppTargetRole[] {
  if (type === 'FACULTY_INTERNSHIP') return ['FACULTY'];
  if (['FDP', 'CONSULTANCY', 'COLLABORATIVE_RESEARCH'].includes(type)) return ['FACULTY'];
  return ['STUDENT'];
}

export default function CompanyCreateFacultyOpp() {
  const navigate = useNavigate();
  const create = useCreateFacultyOpportunity();

  const [requiredExpertise, setRequiredExpertise] = useState<string[]>([]);
  const [preferredQualifications, setPreferredQualifications] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<FacultyOppTargetRole[]>(['FACULTY']);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { openings: 1, stipendCurrency: 'INR' },
  });

  const watchedType = watch('opportunityType');

  function toggleRole(role: FacultyOppTargetRole) {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  function buildPayload(data: FormValues, status: 'DRAFT' | 'PUBLISHED'): CreateFacultyOpportunityInput {
    const stipend =
      data.stipendAmount !== undefined
        ? { amount: data.stipendAmount, currency: data.stipendCurrency || 'INR' }
        : undefined;
    return {
      title: data.title,
      description: data.description,
      opportunityType: data.opportunityType,
      requiredExpertise,
      preferredQualifications,
      location: data.location,
      mode: data.mode,
      applicationDeadline: new Date(data.applicationDeadline).toISOString(),
      openings: data.openings,
      targetRoles: targetRoles.length > 0 ? targetRoles : defaultTargetsFor(data.opportunityType),
      status,
      ...(data.durationWeeks !== undefined ? { durationWeeks: data.durationWeeks } : {}),
      ...(stipend ? { stipend } : {}),
    };
  }

  function submit(status: 'DRAFT' | 'PUBLISHED') {
    return handleSubmit((data) => {
      create.mutate(buildPayload(data, status), {
        onSuccess: () => navigate('/company/faculty-opportunities'),
      });
    });
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Post Faculty Opportunity" subtitle="Create a new faculty-facing program." />

      <form className="space-y-6 max-w-3xl" onSubmit={(e) => e.preventDefault()}>
        <Card>
          <Card.Header>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Basics</h3>
          </Card.Header>
          <Card.Body className="space-y-4">
            <Input label="Title" placeholder="e.g. Faculty Development Program in AI" error={errors.title?.message} {...register('title')} />
            <Textarea
              label="Description"
              rows={6}
              placeholder="Program details, objectives, and expectations…"
              error={errors.description?.message}
              {...register('description')}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Type"
                options={typeOptions}
                placeholder="Select"
                error={errors.opportunityType?.message}
                {...register('opportunityType', {
                  onChange: (e) => setTargetRoles(defaultTargetsFor(e.target.value as FacultyOpportunityType)),
                })}
              />
              <Select label="Mode" options={modeOptions} placeholder="Select" error={errors.mode?.message} {...register('mode')} />
              <Input label="Location" placeholder="Bengaluru" error={errors.location?.message} {...register('location')} />
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Requirements</h3>
          </Card.Header>
          <Card.Body className="space-y-4">
            <ChipInput
              label="Required Expertise"
              values={requiredExpertise}
              onChange={setRequiredExpertise}
              placeholder="e.g. Machine Learning"
            />
            <ChipInput
              label="Preferred Qualifications"
              values={preferredQualifications}
              onChange={setPreferredQualifications}
              placeholder="e.g. Ph.D. in relevant field"
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
              {watchedType && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Recommended: {defaultTargetsFor(watchedType).join(', ')}
                </p>
              )}
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Logistics</h3>
          </Card.Header>
          <Card.Body className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Openings"
                type="number"
                min={1}
                error={errors.openings?.message}
                {...register('openings', { valueAsNumber: true })}
              />
              <Input
                label="Duration (weeks)"
                type="number"
                min={1}
                max={260}
                error={errors.durationWeeks?.message}
                {...register('durationWeeks', { valueAsNumber: true })}
              />
            </div>
            <Input
              label="Application Deadline"
              type="date"
              error={errors.applicationDeadline?.message}
              {...register('applicationDeadline')}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Stipend Amount (optional)"
                type="number"
                min={0}
                error={errors.stipendAmount?.message}
                {...register('stipendAmount', { valueAsNumber: true })}
              />
              <Input
                label="Currency"
                placeholder="INR"
                maxLength={6}
                error={errors.stipendCurrency?.message}
                {...register('stipendCurrency')}
              />
            </div>
          </Card.Body>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/company/faculty-opportunities')}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" loading={create.isPending} onClick={submit('DRAFT')}>
            Save Draft
          </Button>
          <Button type="button" loading={create.isPending} onClick={submit('PUBLISHED')}>
            Publish
          </Button>
        </div>
      </form>
    </div>
  );
}
