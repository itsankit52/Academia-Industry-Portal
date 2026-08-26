import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateInterviewSchema, type UpdateInterviewInput } from '@aip/validation';
import { INTERVIEW_MODES } from '@aip/config';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import { useUpdateInterview } from '@/hooks/queries/useCompanyInterviews';
import type { Interview } from '@aip/types';

interface Props {
  open: boolean;
  onClose: () => void;
  interview: Interview;
}

const modeOptions = INTERVIEW_MODES.map((m) => ({ value: m, label: m.charAt(0) + m.slice(1).toLowerCase() }));

export default function RescheduleInterviewModal({ open, onClose, interview }: Props) {
  const updateInterview = useUpdateInterview();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<UpdateInterviewInput>({
    resolver: zodResolver(updateInterviewSchema),
    defaultValues: {
      mode: interview.mode,
      scheduledAt: interview.scheduledAt.slice(0, 16),
      durationMinutes: interview.durationMinutes,
      meetingLink: interview.meetingLink,
      location: interview.location,
      interviewer: interview.interviewer,
      notes: interview.notes,
    },
  });

  const mode = watch('mode');

  function onSubmit(data: UpdateInterviewInput) {
    updateInterview.mutate(
      { id: interview.id, data: { ...data, status: 'RESCHEDULED' } },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Reschedule Interview" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
        <Select
          label="Mode"
          options={modeOptions}
          error={errors.mode?.message}
          {...register('mode')}
        />

        <Input
          label="New Date & Time"
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
            error={errors.meetingLink?.message}
            {...register('meetingLink')}
          />
        )}

        {mode === 'ONSITE' && (
          <Input
            label="Location"
            error={errors.location?.message}
            {...register('location')}
          />
        )}

        <Textarea
          label="Notes"
          rows={3}
          error={errors.notes?.message}
          {...register('notes')}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={updateInterview.isPending}>
            Reschedule
          </Button>
        </div>
      </form>
    </Modal>
  );
}
