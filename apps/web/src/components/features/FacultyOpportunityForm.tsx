import { useEffect, useState } from 'react';
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
  type UpdateFacultyOpportunityInput,
} from '@aip/validation';
import type { FacultyOpportunity } from '@aip/types';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const typeOptions = FACULTY_OPPORTUNITY_TYPES.map((t) => ({
  value: t,
  label: t.replace(/_/g, ' ').replace(/(\b\w)/g, (c) => c.toUpperCase()),
}));

const modeOptions = WORK_MODES.map((m) => ({
  value: m,
  label: m.charAt(0) + m.slice(1).toLowerCase(),
}));

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

export type FacultyOppFormValues = z.infer<typeof formSchema>;

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

function toDateInput(iso?: string) {
  if (!iso) return '';
  return iso.split('T')[0];
}

function buildPayload(
  data: FacultyOppFormValues,
  targetRoles: FacultyOppTargetRole[],
  status: 'DRAFT' | 'PUBLISHED',
  requiredExpertise: string[],
  preferredQualifications: string[],
  isEdit: boolean,
): CreateFacultyOpportunityInput | UpdateFacultyOpportunityInput {
  const stipend =
    data.stipendAmount !== undefined
      ? { amount: data.stipendAmount, currency: data.stipendCurrency || 'INR' }
      : undefined;
  const base = {
    title: data.title,
    description: data.description,
    opportunityType: data.opportunityType,
    location: data.location,
    mode: data.mode,
    applicationDeadline: new Date(data.applicationDeadline).toISOString(),
    openings: data.openings,
    requiredExpertise,
    preferredQualifications,
    targetRoles:
      targetRoles.length > 0
        ? targetRoles
        : defaultTargetsFor(data.opportunityType as FacultyOpportunityType),
    ...(data.durationWeeks !== undefined ? { durationWeeks: data.durationWeeks } : {}),
    ...(stipend ? { stipend } : {}),
  };
  // Only set status on create (DRAFT/PUBLISHED); updates preserve existing status via
  // the separate PATCH /:id/close endpoint — sending status on PUT would overwrite
  // a CLOSED opportunity back to PUBLISHED.
  if (isEdit) return base;
  return { ...base, status };
}

export interface FacultyOpportunityFormProps {
  initialValues?: FacultyOpportunity;
  initialExpertise?: string[];
  initialQualifications?: string[];
  initialTargetRoles?: FacultyOppTargetRole[];
  initialStatus?: 'DRAFT' | 'PUBLISHED';
  // Accept the partial "update" shape (all fields optional) so parents don't
  // have to reconcile whether status is required or optional. Internally the
  // form builds the create-vs-update payload itself.
  onSubmit: (data: UpdateFacultyOpportunityInput, status: 'DRAFT' | 'PUBLISHED') => void;
  onCancel: () => void;
  submitLabel?: string;
  isLoading?: boolean;
  allowDraft?: boolean;
}

export default function FacultyOpportunityForm({
  initialValues,
  initialExpertise,
  initialQualifications,
  initialTargetRoles,
  initialStatus,
  onSubmit,
  onCancel,
  submitLabel = 'Submit',
  isLoading,
  allowDraft = false,
}: FacultyOpportunityFormProps) {
  const isEdit = !!initialValues;

  const [requiredExpertise, setRequiredExpertise] = useState<string[]>(
    initialExpertise ?? initialValues?.requiredExpertise ?? [],
  );
  const [preferredQualifications, setPreferredQualifications] = useState<string[]>(
    initialQualifications ?? initialValues?.preferredQualifications ?? [],
  );
  const [targetRoles, setTargetRoles] = useState<FacultyOppTargetRole[]>(
    initialTargetRoles ?? initialValues?.targetRoles ?? ['FACULTY'],
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FacultyOppFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialValues?.title,
      description: initialValues?.description,
      opportunityType: initialValues?.opportunityType,
      location: initialValues?.location,
      mode: initialValues?.mode,
      applicationDeadline: toDateInput(initialValues?.applicationDeadline),
      openings: initialValues?.openings ?? 1,
      durationWeeks: initialValues?.durationWeeks,
      stipendAmount: initialValues?.stipend?.amount,
      stipendCurrency: initialValues?.stipend?.currency ?? 'INR',
    },
  });

  const watchedType = watch('opportunityType');

  // When opportunity type changes in edit mode, auto-update target roles
  useEffect(() => {
    if (isEdit && watchedType) {
      const recommended = defaultTargetsFor(watchedType as FacultyOpportunityType);
      setTargetRoles(recommended);
    }
  }, [watchedType, isEdit]);

  function toggleRole(role: FacultyOppTargetRole) {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  function handleFormSubmit(
    data: FacultyOppFormValues,
    status: 'DRAFT' | 'PUBLISHED' = 'PUBLISHED',
  ) {
    const payload = buildPayload(
      data,
      targetRoles,
      status,
      requiredExpertise,
      preferredQualifications,
      isEdit,
    );
    onSubmit(payload, status);
  }

  return (
    <form className="space-y-6 max-w-3xl" onSubmit={(e) => e.preventDefault()}>
      <Card>
        <Card.Header>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Basics</h3>
        </Card.Header>
        <Card.Body className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g. Faculty Development Program in AI"
            error={errors.title?.message}
            {...register('title')}
          />
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
              {...register('opportunityType')}
            />
            <Select
              label="Mode"
              options={modeOptions}
              placeholder="Select"
              error={errors.mode?.message}
              {...register('mode')}
            />
            <Input
              label="Location"
              placeholder="Bengaluru"
              error={errors.location?.message}
              {...register('location')}
            />
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
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Target Roles
            </p>
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
                Recommended: {defaultTargetsFor(watchedType as FacultyOpportunityType).join(', ')}
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
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {allowDraft && (
          <Button
            type="button"
            variant="secondary"
            loading={isLoading}
            onClick={handleSubmit((data) => handleFormSubmit(data, 'DRAFT'))}
          >
            Save Draft
          </Button>
        )}
        <Button
          type="button"
          loading={isLoading}
          onClick={handleSubmit((data) => handleFormSubmit(data, 'PUBLISHED'))}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

// Export helpers for parent pages to build payloads
export { defaultTargetsFor, toDateInput };
