import { useForm } from 'react-hook-form';
import { COLLAB_EVENT_TYPES, ROLES } from '@aip/config';
import type { CollabEventType, Role } from '@aip/config';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

export interface EventFormValues {
  title: string;
  description: string;
  eventType: CollabEventType;
  startAt: string;
  endAt?: string;
  location?: string;
  mode: 'ONLINE' | 'ONSITE' | 'HYBRID';
  meetingLink?: string;
  capacity?: number;
  registrationDeadline?: string;
  targetAudience?: Role[];
  tags?: string;
}

interface EventFormProps {
  defaultValues?: Partial<EventFormValues>;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (v: EventFormValues) => void;
  onCancel?: () => void;
}

const eventTypeOptions = COLLAB_EVENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }));
const modeOptions = [
  { value: 'ONSITE', label: 'Onsite' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'HYBRID', label: 'Hybrid' },
];

function toDateTimeLocal(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventForm({
  defaultValues,
  submitting,
  submitLabel = 'Save',
  onSubmit,
  onCancel,
}: EventFormProps) {
  const { register, handleSubmit, formState } = useForm<EventFormValues>({
    defaultValues: {
      title: defaultValues?.title ?? '',
      description: defaultValues?.description ?? '',
      eventType: defaultValues?.eventType ?? 'WORKSHOP',
      startAt: toDateTimeLocal(defaultValues?.startAt),
      endAt: toDateTimeLocal(defaultValues?.endAt),
      location: defaultValues?.location ?? '',
      mode: defaultValues?.mode ?? 'ONSITE',
      meetingLink: defaultValues?.meetingLink ?? '',
      capacity: defaultValues?.capacity,
      registrationDeadline: toDateTimeLocal(defaultValues?.registrationDeadline),
      targetAudience: defaultValues?.targetAudience ?? ['STUDENT'],
      tags: Array.isArray(defaultValues?.tags) ? (defaultValues?.tags as string[]).join(', ') : defaultValues?.tags ?? '',
    },
  });

  const submit = handleSubmit((values) => {
    const tags = typeof values.tags === 'string'
      ? values.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : values.tags ?? [];
    const iso = (v?: string) => (v ? new Date(v).toISOString() : undefined);
    onSubmit({
      ...values,
      tags: tags as unknown as string,
      startAt: iso(values.startAt) as string,
      ...(values.endAt ? { endAt: iso(values.endAt) as string } : { endAt: undefined }),
      ...(values.registrationDeadline
        ? { registrationDeadline: iso(values.registrationDeadline) as string }
        : { registrationDeadline: undefined }),
    });
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        label="Title"
        required
        error={formState.errors.title?.message}
        {...register('title', { required: 'Title required', minLength: { value: 3, message: 'Min 3 chars' } })}
      />
      <Textarea
        label="Description"
        required
        rows={5}
        error={formState.errors.description?.message}
        {...register('description', { required: 'Description required', minLength: { value: 20, message: 'Min 20 chars' } })}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select label="Event type" options={eventTypeOptions} {...register('eventType', { required: true })} />
        <Select label="Mode" options={modeOptions} {...register('mode', { required: true })} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          type="datetime-local"
          label="Starts at"
          required
          error={formState.errors.startAt?.message}
          {...register('startAt', { required: 'Start date required' })}
        />
        <Input type="datetime-local" label="Ends at (optional)" {...register('endAt')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Location" placeholder="City or venue" {...register('location')} />
        <Input label="Meeting link (for online)" placeholder="https://..." {...register('meetingLink')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input type="number" label="Capacity" min={1} {...register('capacity', { valueAsNumber: true })} />
        <Input type="datetime-local" label="Registration deadline" {...register('registrationDeadline')} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300">Target audience</label>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((role) => (
            <label key={role} className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" value={role} {...register('targetAudience')} className="rounded" />
              {role}
            </label>
          ))}
        </div>
      </div>
      <Input label="Tags (comma separated)" placeholder="react, workshop, frontend" {...register('tags')} />
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" loading={submitting}>{submitLabel}</Button>
      </div>
    </form>
  );
}
