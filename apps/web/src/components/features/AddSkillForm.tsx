import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PROFICIENCY_LEVELS } from '@aip/config';
import type { Proficiency } from '@aip/config';
import FormField from '@/components/ui/FormField';
import RadioGroup from '@/components/ui/RadioGroup';
import Button from '@/components/ui/Button';
import { useSkillsCatalog } from '@/hooks/queries/useSkillsCatalog';
import { useAddStudentSkill } from '@/hooks/queries/useAddStudentSkill';

const schema = z.object({
  skillId: z.string().min(1, 'Please select a skill'),
  proficiency: z.enum(PROFICIENCY_LEVELS as unknown as [Proficiency, ...Proficiency[]]),
  yearsExperience: z.coerce.number().min(0).max(50).optional(),
  evidenceUrl: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export default function AddSkillForm() {
  const { data: catalogData } = useSkillsCatalog();
  const catalog = catalogData?.items;
  const addSkill = useAddStudentSkill();

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { proficiency: 'BEGINNER', skillId: '', evidenceUrl: '' },
  });

  const { field: profField } = useController({ control, name: 'proficiency' });

  const skillOptions = [
    { value: '', label: 'Select a skill…' },
    ...(catalog ?? []).map((s) => ({ value: s.id, label: s.name })),
  ];

  const proficiencyOptions = PROFICIENCY_LEVELS.map((p) => ({
    value: p,
    label: p.charAt(0) + p.slice(1).toLowerCase(),
  }));

  function onSubmit(data: FormValues) {
    addSkill.mutate(
      {
        skillId: data.skillId,
        proficiency: data.proficiency,
        yearsExperience: data.yearsExperience,
        evidenceUrl: data.evidenceUrl || undefined,
      },
      { onSuccess: () => reset() },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        control={control}
        name="skillId"
        as="select"
        label="Skill"
        options={skillOptions}
      />
      <RadioGroup
        name="proficiency"
        label="Proficiency"
        options={proficiencyOptions}
        value={profField.value}
        onChange={profField.onChange}
      />
      <FormField
        control={control}
        name="yearsExperience"
        label="Years of Experience"
        type="number"
        placeholder="0"
      />
      <FormField
        control={control}
        name="evidenceUrl"
        label="Evidence URL"
        type="url"
        placeholder="https://github.com/…"
      />
      <Button type="submit" loading={addSkill.isPending} size="sm">
        Add Skill
      </Button>
    </form>
  );
}
