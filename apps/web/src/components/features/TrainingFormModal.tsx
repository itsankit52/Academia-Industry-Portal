import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createTrainingSchema, type CreateTrainingInput } from '@aip/validation';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import SkillPicker from './SkillPicker';
import { useCreateTraining, useUpdateTraining } from '@/hooks/queries/useAdminTrainings';
import type { TrainingProgram } from '@aip/types';

interface Props {
  open: boolean;
  onClose: () => void;
  training?: TrainingProgram;
}

// Mirror the createTrainingSchema fields except `skills` so we don't need to
// call `.omit()` on the ZodEffects (which has no omit method).  The
// superRefine rule (EXTERNAL requires registrationUrl) doesn't apply in the
// modal since we omit `contentType` and only expose the URL as optional.
const formSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(20).max(5000),
  provider: z.string().min(1).max(200),
  durationWeeks: z.number().int().min(1).max(104),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  registrationDeadline: z.string().datetime().optional(),
  registrationUrl: z.string().url().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
  contentType: z.enum(['INTERNAL', 'EXTERNAL', 'HYBRID']).default('INTERNAL'),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).default('INTERMEDIATE'),
  estimatedHours: z.number().min(0).max(10000).optional(),
  certificateAvailable: z.boolean().default(false),
});
type FormData = z.infer<typeof formSchema>;

export default function TrainingFormModal({ open, onClose, training }: Props) {
  const createTraining = useCreateTraining();
  const updateTraining = useUpdateTraining();
  const isEdit = !!training;
  const [skills, setSkills] = useState<string[]>(training?.skills.map((s) => s.id) ?? []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: training
      ? {
          title: training.title,
          description: training.description,
          provider: training.provider,
          durationWeeks: training.durationWeeks,
          registrationUrl: training.registrationUrl,
          status: training.status,
        }
      : undefined,
  });

  useEffect(() => {
    if (open) {
      reset(
        training
          ? {
              title: training.title,
              description: training.description,
              provider: training.provider,
              durationWeeks: training.durationWeeks,
              registrationUrl: training.registrationUrl,
              status: training.status,
            }
          : undefined,
      );
      setSkills(training?.skills.map((s) => s.id) ?? []);
    }
  }, [open, training, reset]);

  function onSubmit(data: FormData) {
    const payload: CreateTrainingInput = { ...data, skills };
    if (isEdit && training) {
      updateTraining.mutate({ id: training.id, data: payload }, { onSuccess: onClose });
    } else {
      createTraining.mutate(payload, { onSuccess: onClose });
    }
  }

  const isPending = createTraining.isPending || updateTraining.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Training' : 'Create Training'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
        <Input
          label="Title"
          placeholder="e.g. Full Stack Web Development"
          error={errors.title?.message}
          {...register('title')}
        />

        <Textarea
          label="Description"
          rows={4}
          placeholder="What will participants learn?"
          error={errors.description?.message}
          {...register('description')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Provider"
            placeholder="e.g. Coursera"
            error={errors.provider?.message}
            {...register('provider')}
          />
          <Input
            label="Duration (weeks)"
            type="number"
            min={1}
            max={104}
            error={errors.durationWeeks?.message}
            {...register('durationWeeks', { valueAsNumber: true })}
          />
        </div>

        <Input
          label="Registration URL"
          type="url"
          placeholder="https://..."
          error={errors.registrationUrl?.message}
          {...register('registrationUrl')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date (optional)"
            type="datetime-local"
            error={errors.startDate?.message}
            {...register('startDate')}
          />
          <Input
            label="Registration Deadline (optional)"
            type="datetime-local"
            error={errors.registrationDeadline?.message}
            {...register('registrationDeadline')}
          />
        </div>

        <SkillPicker label="Skills Covered" value={skills} onChange={setSkills} />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={isPending}>
            {isEdit ? 'Save Changes' : 'Create Training'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
