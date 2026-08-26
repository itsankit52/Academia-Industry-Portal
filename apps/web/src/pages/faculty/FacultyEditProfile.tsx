import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiPlus, FiX } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import FormField from '@/components/ui/FormField';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useFacultyProfile, useUpdateFacultyProfile } from '@/hooks/queries/useFacultyProfile';
import type { UpdateFacultyProfileInput } from '@aip/validation';

const schema = z.object({
  designation: z.string().trim().min(1).max(120).optional(),
  department: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  bio: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

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

export default function FacultyEditProfile() {
  const navigate = useNavigate();
  const { data: profile, isLoading, isError, refetch } = useFacultyProfile();
  const update = useUpdateFacultyProfile();

  const [qualifications, setQualifications] = useState<string[]>([]);
  const [researchInterests, setResearchInterests] = useState<string[]>([]);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!profile) return;
    reset({
      designation: profile.designation,
      department: profile.department,
      phone: profile.phone ?? '',
      city: profile.city ?? '',
      state: profile.state ?? '',
      bio: profile.bio ?? '',
    });
    setQualifications(profile.qualifications ?? []);
    setResearchInterests(profile.researchInterests ?? []);
  }, [profile, reset]);

  function onSubmit(data: FormValues) {
    const payload: UpdateFacultyProfileInput = {
      designation: data.designation,
      department: data.department,
      phone: data.phone || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
      bio: data.bio || undefined,
      qualifications,
      researchInterests,
    };
    update.mutate(payload, {
      onSuccess: () => navigate('/faculty/profile'),
    });
  }

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container-page py-8">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Edit Profile"
        subtitle="Update your professional details."
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/faculty/profile')}>
            Cancel
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <Card.Header>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Personal
            </h2>
          </Card.Header>
          <Card.Body className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={control} name="designation" label="Designation" placeholder="Professor" />
            <FormField control={control} name="department" label="Department" placeholder="CSE" />
            <FormField control={control} name="phone" label="Phone" type="tel" placeholder="+91 …" />
            <FormField control={control} name="city" label="City" placeholder="Bengaluru" />
            <FormField control={control} name="state" label="State" placeholder="Karnataka" />
            <div className="sm:col-span-2">
              <FormField control={control} name="bio" as="textarea" label="Bio" rows={4} placeholder="A brief bio…" />
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Expertise
            </h2>
          </Card.Header>
          <Card.Body className="space-y-4">
            <ChipInput
              label="Qualifications"
              values={qualifications}
              onChange={setQualifications}
              placeholder="e.g. Ph.D. Computer Science"
            />
            <ChipInput
              label="Research Interests"
              values={researchInterests}
              onChange={setResearchInterests}
              placeholder="e.g. Distributed Systems"
            />
          </Card.Body>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/faculty/profile')}>
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
