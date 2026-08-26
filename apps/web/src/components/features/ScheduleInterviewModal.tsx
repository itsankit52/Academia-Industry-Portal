import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createInterviewSchema, type CreateInterviewInput } from '@aip/validation';
import { INTERVIEW_MODES } from '@aip/config';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import { useCreateInterview } from '@/hooks/queries/useCompanyInterviews';

interface Props {
  open: boolean;
  onClose: () => void;
  applicationId: string;
}

const modeOptions = INTERVIEW_MODES.map((m) => ({ value: m, label: m.charAt(0) + m.slice(1).toLowerCase() }));

export default function ScheduleInterviewModal({ open, onClose, applicationId }: Props) {
  const createInterview = useCreateInterview();

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<CreateInterviewInput>({
    resolver: zodResolver(createInterviewSchema),
    defaultValues: { applicationId, durationMinutes: 60 },
  });

  const mode = watch('mode');

  function onSubmit(data: CreateInterviewInput) {
    createInterview.mutate(data, {
      onSuccess: () => { reset(); onClose(); },
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule Interview" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
        <input type="hidden" {...register('applicationId')} />

        <Select
          label="Mode"
          options={modeOptions}
          placeholder="Select mode"
          error={errors.mode?.message}
          {...register('mode')}
        />

        <Input
          label="Scheduled At"
          type="datetime-local"
          error={errors.scheduledAt?.message}
          {...register('scheduledAt')}
        />

        <Input
          label="Duration (minutes)"
          type="number"
          min={15}
          max={480}
          error={errors.durationMinutes?.message}
          {...register('durationMinutes', { valueAsNumber: true })}
        />

        {mode === 'ONLINE' && (
          <Input
            label="Meeting Link"
            type="url"
            placeholder="https://meet.google.com/..."
            error={errors.meetingLink?.message}
            {...register('meetingLink')}
          />
        )}

        {mode === 'ONSITE' && (
          <Input
            label="Location"
            placeholder="Office address or room"
            error={errors.location?.message}
            {...register('location')}
          />
        )}

        <Input
          label="Interviewer Name"
          placeholder="John Doe"
          error={errors.interviewer?.message}
          {...register('interviewer')}
        />

        <Textarea
          label="Notes (optional)"
          rows={3}
          placeholder="Any preparation notes for the candidate…"
          error={errors.notes?.message}
          {...register('notes')}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={createInterview.isPending}>
            Schedule
          </Button>
        </div>
      </form>
    </Modal>
  );
}
