import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiTrash2 } from 'react-icons/fi';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import { useCreateStudentProject } from '@/hooks/queries/useCreateStudentProject';
import { useUpdateStudentProject } from '@/hooks/queries/useUpdateStudentProject';
import type { StudentProject } from '@/hooks/queries/useStudentProjects';

const rawSchema = z.object({
  title: z.string().min(3, 'At least 3 characters').max(200, 'Max 200 characters'),
  description: z.string().min(10, 'At least 10 characters').max(5000, 'Max 5000 characters'),
  role: z.string().max(200).optional(),
  technologies: z.string().max(500, 'Technologies list too long').optional(),
  completedAt: z.string().datetime().optional().nullable(),
  isPublic: z.boolean().default(true),
});

const validatedSchema = rawSchema.extend({
  technologies: z
    .string()
    .max(500, 'Technologies list too long')
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 30)
        : [],
    ),
});

type FormValues = z.input<typeof rawSchema>;
type ValidatedValues = z.infer<typeof validatedSchema>;

interface Props {
  project?: StudentProject | null;
  onClose: () => void;
}

export default function ProjectForm({ project, onClose }: Props) {
  const create = useCreateStudentProject();
  const update = useUpdateStudentProject();
  const isEdit = !!project;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(rawSchema),
    defaultValues: {
      title: '',
      description: '',
      role: '',
      technologies: '',
      completedAt: undefined,
      isPublic: true,
    },
  });

  const technologiesValue = watch('technologies') ?? '';

  useEffect(() => {
    if (project) {
      reset({
        title: project.title,
        description: project.description,
        role: project.role ?? '',
        technologies: (project.technologies ?? []).join(', '),
        completedAt: project.completedAt ?? null,
        isPublic: project.isPublic,
      });
    } else {
      reset({
        title: '',
        description: '',
        role: '',
        technologies: '',
        completedAt: undefined,
        isPublic: true,
      });
    }
  }, [project, reset]);

  function onSubmit(data: FormValues) {
    // Re-parse with the schema that includes the technologies transform —
    // the resolver above runs the field-level validation on the raw string.
    const parsed: ValidatedValues = validatedSchema.parse(data);
    const payload = {
      title: parsed.title,
      description: parsed.description,
      ...(parsed.role ? { role: parsed.role } : {}),
      ...(parsed.technologies.length > 0 ? { technologies: parsed.technologies } : {}),
      ...(parsed.completedAt ? { completedAt: parsed.completedAt } : {}),
    };

    if (isEdit && project) {
      update.mutate(
        { id: project._id, payload: { ...payload, isPublic: parsed.isPublic } },
        { onSuccess: onClose },
      );
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  }

  const techTags: string[] = technologiesValue
    ? technologiesValue
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean)
        .slice(0, 30)
    : [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Project Title *"
        placeholder="e.g. E-Commerce Platform with React"
        {...register('title')}
        error={errors.title?.message}
      />

      <Textarea
        label="Description *"
        placeholder="Describe what you built, your contributions, and the impact…"
        rows={4}
        {...register('description')}
        error={errors.description?.message}
      />

      <Input
        label="Your Role"
        placeholder="e.g. Full Stack Developer, Solo Project"
        {...register('role')}
        error={errors.role?.message}
      />

      <div className="space-y-1">
        <Input
          label="Technologies"
          placeholder="React, Node.js, MongoDB (comma-separated, max 30)"
          value={technologiesValue}
          {...register('technologies')}
          error={errors.technologies?.message}
        />
        {techTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {techTags.map((t: string) => (
              <span
                key={t}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <Input
        label="Completion Date"
        type="date"
        {...register('completedAt')}
        error={errors.completedAt?.message}
      />

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          {...register('isPublic')}
          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm text-slate-700 dark:text-slate-300">
          Public — visible on my portfolio
        </span>
      </label>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" loading={create.isPending || update.isPending}>
          {isEdit ? 'Save Changes' : 'Add Project'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={create.isPending || update.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
