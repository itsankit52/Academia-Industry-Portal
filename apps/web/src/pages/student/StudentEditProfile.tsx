import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { GENDERS } from '@aip/config';
import type { Gender } from '@aip/config';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useStudentProfile } from '@/hooks/queries/useStudentProfile';
import { useUpdateStudentProfile } from '@/hooks/queries/useUpdateStudentProfile';
import type { UpdateStudentProfileInput } from '@aip/validation';

const genderOptions = [
  { value: '', label: 'Prefer not to say' },
  ...GENDERS.map((g) => ({ value: g, label: g.charAt(0) + g.slice(1).toLowerCase() })),
];

function toDateInput(iso?: string) {
  if (!iso) return '';
  return iso.split('T')[0];
}

function toIso(d?: string) {
  if (!d) return undefined;
  return d.includes('T') ? d : `${d}T00:00:00.000Z`;
}

const schema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  phone: z.string().max(30).optional(),
  dob: z.string().optional(),
  gender: z.enum(GENDERS as unknown as [Gender, ...Gender[]]).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  address: z.string().max(500).optional(),
  college: z.string().max(200).optional(),
  university: z.string().max(200).optional(),
  degree: z.string().max(120).optional(),
  branch: z.string().max(120).optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  graduationYear: z.coerce.number().int().min(1950).max(2100).optional(),
  cgpa: z.coerce.number().min(0).max(10).optional(),
  bio: z.string().max(2000).optional(),
  preferredRolesText: z.string().optional(),
  preferredLocationsText: z.string().optional(),
  projects: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(2000),
        techStackText: z.string().optional(),
        link: z.string().url().optional().or(z.literal('')),
      }),
    )
    .optional(),
  certifications: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        issuer: z.string().min(1).max(200),
        issuedAt: z.string().optional(),
        credentialUrl: z.string().url().optional().or(z.literal('')),
      }),
    )
    .optional(),
  experience: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        organization: z.string().min(1).max(200),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        description: z.string().max(2000).optional(),
      }),
    )
    .optional(),
  achievements: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        date: z.string().optional(),
      }),
    )
    .optional(),
});

type FormValues = z.infer<typeof schema>;

export default function StudentEditProfile() {
  const navigate = useNavigate();
  const { data: profile, isLoading, isError, refetch } = useStudentProfile();
  const update = useUpdateStudentProfile();

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const projects = useFieldArray({ control, name: 'projects' });
  const certifications = useFieldArray({ control, name: 'certifications' });
  const experience = useFieldArray({ control, name: 'experience' });
  const achievements = useFieldArray({ control, name: 'achievements' });

  useEffect(() => {
    if (!profile) return;
    reset({
      fullName: profile.fullName,
      phone: profile.phone ?? '',
      dob: toDateInput(profile.dob),
      gender: profile.gender,
      city: profile.city ?? '',
      state: profile.state ?? '',
      address: profile.address ?? '',
      college: profile.college ?? '',
      university: profile.university ?? '',
      degree: profile.degree ?? '',
      branch: profile.branch ?? '',
      semester: profile.semester,
      graduationYear: profile.graduationYear,
      cgpa: profile.cgpa,
      bio: profile.bio ?? '',
      preferredRolesText: profile.preferredRoles.join(', '),
      preferredLocationsText: profile.preferredLocations.join(', '),
      projects: profile.projects.map((p) => ({
        title: p.title,
        description: p.description,
        techStackText: p.techStack.join(', '),
        link: p.link ?? '',
      })),
      certifications: profile.certifications.map((c) => ({
        title: c.title,
        issuer: c.issuer,
        issuedAt: toDateInput(c.issuedAt),
        credentialUrl: c.credentialUrl ?? '',
      })),
      experience: profile.experience.map((e) => ({
        title: e.title,
        organization: e.organization,
        startDate: toDateInput(e.startDate),
        endDate: toDateInput(e.endDate),
        description: e.description ?? '',
      })),
      achievements: profile.achievements.map((a) => ({
        title: a.title,
        description: a.description ?? '',
        date: toDateInput(a.date),
      })),
    });
  }, [profile, reset]);

  function onSubmit(data: FormValues) {
    const payload: UpdateStudentProfileInput = {
      fullName: data.fullName,
      phone: data.phone || undefined,
      dob: toIso(data.dob),
      gender: data.gender,
      city: data.city || undefined,
      state: data.state || undefined,
      address: data.address || undefined,
      college: data.college || undefined,
      university: data.university || undefined,
      degree: data.degree || undefined,
      branch: data.branch || undefined,
      semester: data.semester,
      graduationYear: data.graduationYear,
      cgpa: data.cgpa,
      bio: data.bio || undefined,
      preferredRoles: data.preferredRolesText
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      preferredLocations: data.preferredLocationsText
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      projects: data.projects?.map((p) => ({
        title: p.title,
        description: p.description,
        techStack: p.techStackText?.split(',').map((s) => s.trim()).filter(Boolean) ?? [],
        link: p.link || undefined,
      })),
      certifications: data.certifications?.map((c) => ({
        title: c.title,
        issuer: c.issuer,
        issuedAt: toIso(c.issuedAt) ?? new Date().toISOString(),
        credentialUrl: c.credentialUrl || undefined,
      })),
      experience: data.experience?.map((e) => ({
        title: e.title,
        organization: e.organization,
        startDate: toIso(e.startDate) ?? new Date().toISOString(),
        endDate: toIso(e.endDate),
        description: e.description || undefined,
      })),
      achievements: data.achievements?.map((a) => ({
        title: a.title,
        description: a.description || undefined,
        date: toIso(a.date),
      })),
    };
    update.mutate(payload);
  }

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
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
        subtitle="Update your personal and academic details."
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/student/profile')}>
            Cancel
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <Card.Header>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Personal</h2>
          </Card.Header>
          <Card.Body className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={control} name="fullName" label="Full Name" placeholder="Jane Doe" />
            <FormField control={control} name="phone" label="Phone" type="tel" placeholder="+91 98765 43210" />
            <FormField control={control} name="dob" label="Date of Birth" type="date" />
            <FormField control={control} name="gender" as="select" label="Gender" options={genderOptions} />
            <FormField control={control} name="city" label="City" placeholder="Bangalore" />
            <FormField control={control} name="state" label="State" placeholder="Karnataka" />
            <div className="sm:col-span-2">
              <FormField control={control} name="address" label="Address" placeholder="123 Main St…" />
            </div>
            <div className="sm:col-span-2">
              <FormField control={control} name="bio" as="textarea" label="Bio" rows={4} placeholder="Tell us about yourself…" />
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Academic</h2>
          </Card.Header>
          <Card.Body className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={control} name="college" label="College" placeholder="IIT Bombay" />
            <FormField control={control} name="university" label="University" placeholder="Mumbai University" />
            <FormField control={control} name="degree" label="Degree" placeholder="B.Tech" />
            <FormField control={control} name="branch" label="Branch" placeholder="Computer Science" />
            <FormField control={control} name="semester" label="Semester" type="number" placeholder="6" />
            <FormField control={control} name="graduationYear" label="Graduation Year" type="number" placeholder="2025" />
            <FormField control={control} name="cgpa" label="CGPA" type="number" placeholder="8.5" />
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Preferences</h2>
          </Card.Header>
          <Card.Body className="space-y-4">
            <FormField
              control={control}
              name="preferredRolesText"
              label="Preferred Roles (comma-separated)"
              placeholder="Software Engineer, Data Scientist"
            />
            <FormField
              control={control}
              name="preferredLocationsText"
              label="Preferred Locations (comma-separated)"
              placeholder="Bangalore, Remote"
            />
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Experience</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                iconLeft={<FiPlus className="w-4 h-4" />}
                onClick={() => experience.append({ title: '', organization: '', startDate: '', endDate: '', description: '' })}
              >
                Add
              </Button>
            </div>
          </Card.Header>
          <Card.Body className="space-y-4">
            {experience.fields.map((field, i) => (
              <div key={field.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => experience.remove(i)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 transition-colors"
                  aria-label="Remove experience"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField control={control} name={`experience.${i}.title`} label="Title" placeholder="Software Intern" />
                  <FormField control={control} name={`experience.${i}.organization`} label="Organization" placeholder="Acme Corp" />
                  <FormField control={control} name={`experience.${i}.startDate`} label="Start Date" type="date" />
                  <FormField control={control} name={`experience.${i}.endDate`} label="End Date" type="date" />
                </div>
                <FormField control={control} name={`experience.${i}.description`} as="textarea" label="Description" rows={2} />
              </div>
            ))}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Projects</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                iconLeft={<FiPlus className="w-4 h-4" />}
                onClick={() => projects.append({ title: '', description: '', techStackText: '', link: '' })}
              >
                Add
              </Button>
            </div>
          </Card.Header>
          <Card.Body className="space-y-4">
            {projects.fields.map((field, i) => (
              <div key={field.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => projects.remove(i)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 transition-colors"
                  aria-label="Remove project"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
                <FormField control={control} name={`projects.${i}.title`} label="Project Title" placeholder="My App" />
                <FormField control={control} name={`projects.${i}.description`} as="textarea" label="Description" rows={2} />
                <FormField control={control} name={`projects.${i}.techStackText`} label="Tech Stack (comma-separated)" placeholder="React, Node.js, PostgreSQL" />
                <FormField control={control} name={`projects.${i}.link`} label="Project Link" type="url" placeholder="https://github.com/…" />
              </div>
            ))}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Certifications</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                iconLeft={<FiPlus className="w-4 h-4" />}
                onClick={() => certifications.append({ title: '', issuer: '', issuedAt: '', credentialUrl: '' })}
              >
                Add
              </Button>
            </div>
          </Card.Header>
          <Card.Body className="space-y-4">
            {certifications.fields.map((field, i) => (
              <div key={field.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => certifications.remove(i)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 transition-colors"
                  aria-label="Remove certification"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField control={control} name={`certifications.${i}.title`} label="Title" placeholder="AWS Certified Developer" />
                  <FormField control={control} name={`certifications.${i}.issuer`} label="Issuer" placeholder="Amazon Web Services" />
                  <FormField control={control} name={`certifications.${i}.issuedAt`} label="Issue Date" type="date" />
                  <FormField control={control} name={`certifications.${i}.credentialUrl`} label="Credential URL" type="url" placeholder="https://…" />
                </div>
              </div>
            ))}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Achievements</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                iconLeft={<FiPlus className="w-4 h-4" />}
                onClick={() => achievements.append({ title: '', description: '', date: '' })}
              >
                Add
              </Button>
            </div>
          </Card.Header>
          <Card.Body className="space-y-4">
            {achievements.fields.map((field, i) => (
              <div key={field.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => achievements.remove(i)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 transition-colors"
                  aria-label="Remove achievement"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
                <FormField control={control} name={`achievements.${i}.title`} label="Title" placeholder="Hackathon Winner" />
                <FormField control={control} name={`achievements.${i}.date`} label="Date" type="date" />
                <FormField control={control} name={`achievements.${i}.description`} as="textarea" label="Description" rows={2} />
              </div>
            ))}
          </Card.Body>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/student/profile')}
          >
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
