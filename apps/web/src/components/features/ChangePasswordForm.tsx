import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(8, 'Must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Required'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordForm() {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormValues) {
    try {
      await apiPost('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Password changed successfully.');
      reset();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to change password.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        control={control}
        name="currentPassword"
        label="Current Password"
        type="password"
        placeholder="••••••••"
      />
      <FormField
        control={control}
        name="newPassword"
        label="New Password"
        type="password"
        placeholder="••••••••"
      />
      <FormField
        control={control}
        name="confirmPassword"
        label="Confirm New Password"
        type="password"
        placeholder="••••••••"
      />
      <div className="pt-2">
        <Button type="submit" loading={isSubmitting}>
          Change Password
        </Button>
      </div>
    </form>
  );
}
