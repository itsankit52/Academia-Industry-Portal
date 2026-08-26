import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateCompanyProfileSchema, type UpdateCompanyProfileInput } from '@aip/validation';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import FileDrop from '@/components/ui/FileDrop';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useCompanyProfile, useUpdateCompanyProfile, useUploadLogo } from '@/hooks/queries/useCompanyProfile';

export default function CompanyEditProfile() {
  const navigate = useNavigate();
  const { data: profile, isLoading, isError, refetch } = useCompanyProfile();
  const updateProfile = useUpdateCompanyProfile();
  const uploadLogo = useUploadLogo();
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateCompanyProfileInput>({
    resolver: zodResolver(updateCompanyProfileSchema),
  });

  useEffect(() => {
    if (profile) {
      reset({
        companyName: profile.companyName,
        description: profile.description,
        industry: profile.industry,
        website: profile.website,
        phone: profile.phone,
        location: profile.location,
        companySize: profile.companySize,
        foundedYear: profile.foundedYear,
      });
    }
  }, [profile, reset]);

  async function onSubmit(data: UpdateCompanyProfileInput) {
    if (logoFile) {
      await uploadLogo.mutateAsync(logoFile);
    }
    updateProfile.mutate(data, { onSuccess: () => navigate('/company/profile') });
  }

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Edit Profile"
        subtitle="Update your company's public information."
      />

      {isLoading ? (
        <SkeletonCard className="h-96" />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
          <Card>
            <Card.Header>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Company Logo</h3>
            </Card.Header>
            <Card.Body>
              <FileDrop
                label="Upload Logo"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={setLogoFile}
              />
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Basic Information</h3>
            </Card.Header>
            <Card.Body className="space-y-4">
              <Input
                label="Company Name"
                placeholder="Acme Corp"
                error={errors.companyName?.message}
                {...register('companyName')}
              />
              <Input
                label="Industry"
                placeholder="e.g. Software, Finance, Healthcare"
                error={errors.industry?.message}
                {...register('industry')}
              />
              <Textarea
                label="Description"
                rows={5}
                placeholder="Tell candidates about your company…"
                error={errors.description?.message}
                {...register('description')}
              />
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Contact & Location</h3>
            </Card.Header>
            <Card.Body className="space-y-4">
              <Input
                label="Website"
                type="url"
                placeholder="https://yourcompany.com"
                error={errors.website?.message}
                {...register('website')}
              />
              <Input
                label="Phone"
                type="tel"
                placeholder="+91 98765 43210"
                error={errors.phone?.message}
                {...register('phone')}
              />
              <Input
                label="Location"
                placeholder="Bangalore, India"
                error={errors.location?.message}
                {...register('location')}
              />
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Team & Founded</h3>
            </Card.Header>
            <Card.Body className="space-y-4">
              <Input
                label="Company Size"
                placeholder="e.g. 50-200"
                error={errors.companySize?.message}
                {...register('companySize')}
              />
              <Input
                label="Founded Year"
                type="number"
                placeholder="2010"
                error={errors.foundedYear?.message}
                {...register('foundedYear', { valueAsNumber: true })}
              />
            </Card.Body>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/company/profile')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={updateProfile.isPending || uploadLogo.isPending}
            >
              Save Changes
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
