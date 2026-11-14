import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createSkillSchema, type CreateSkillInput } from '@aip/validation';
import { SKILL_CATEGORIES } from '@aip/config';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import { useCreateSkill, useUpdateSkill } from '@/hooks/queries/useSkills';
import type { Skill } from '@aip/types';

interface Props {
  open: boolean;
  onClose: () => void;
  skill?: Skill;
}

const categoryOptions = SKILL_CATEGORIES.map((c) => ({
  value: c,
  label: c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
}));

export default function SkillFormModal({ open, onClose, skill }: Props) {
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();
  const isEdit = !!skill;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateSkillInput>({
    resolver: zodResolver(createSkillSchema),
    defaultValues: skill
      ? { name: skill.name, category: skill.category, description: skill.description }
      : undefined,
  });

  useEffect(() => {
    if (open) {
      reset(
        skill
          ? { name: skill.name, category: skill.category, description: skill.description }
          : { name: '', description: '' },
      );
    }
  }, [open, skill, reset]);

  function onSubmit(data: CreateSkillInput) {
    if (isEdit && skill) {
      updateSkill.mutate({ id: skill.id, data }, { onSuccess: onClose });
    } else {
      createSkill.mutate(data, { onSuccess: onClose });
    }
  }

  const isPending = createSkill.isPending || updateSkill.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Skill' : 'Create Skill'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
        <Input
          label="Skill Name"
          placeholder="e.g. React"
          error={errors.name?.message}
          {...register('name')}
        />

        <Select
          label="Category"
          options={categoryOptions}
          placeholder="Select category"
          // Every listed option is valid, so an error here means none was chosen
          // (the placeholder's "" fails the shared enum schema).
          error={errors.category ? 'Select a category.' : undefined}
          {...register('category')}
        />

        <Textarea
          label="Description (optional)"
          rows={3}
          placeholder="Brief description of the skill…"
          error={errors.description?.message}
          {...register('description')}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={isPending}>
            {isEdit ? 'Save Changes' : 'Create Skill'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
