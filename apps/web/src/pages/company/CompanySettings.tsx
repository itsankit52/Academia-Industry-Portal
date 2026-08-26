import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { apiPost } from '@/lib/api';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string().min(1, 'Required'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type PasswordInput = z.infer<typeof passwordSchema>;

const NOTIF_KEY = 'company_notif_prefs';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export default function CompanySettings() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => ({
    newApplication: true,
    interviewReminder: true,
    statusChange: true,
    ...loadPrefs(),
  }));
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordInput>({
    resolver: zodResolver(passwordSchema),
  });

  async function changePassword(data: PasswordInput) {
    setSaving(true);
    try {
      await apiPost('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Password changed successfully.');
      reset();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function togglePref(key: string) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
    toast.success('Preferences saved.');
  }

  const notifOptions = [
    { key: 'newApplication', label: 'New application received' },
    { key: 'interviewReminder', label: 'Interview reminders' },
    { key: 'statusChange', label: 'Application status changes' },
  ];

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Settings" subtitle="Manage your company account preferences." />

      <div className="max-w-xl space-y-6">
        <Card>
          <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Change Password</h3></Card.Header>
          <Card.Body>
            <form onSubmit={handleSubmit(changePassword)} className="space-y-4">
              <Input label="Current Password" type="password" error={errors.currentPassword?.message} {...register('currentPassword')} />
              <Input label="New Password" type="password" error={errors.newPassword?.message} {...register('newPassword')} />
              <Input label="Confirm New Password" type="password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
              <Button type="submit" size="sm" loading={saving}>Update Password</Button>
            </form>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Notification Preferences</h3></Card.Header>
          <Card.Body>
            <div className="space-y-3">
              {notifOptions.map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs[key]}
                    onClick={() => togglePref(key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${prefs[key] ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${prefs[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>
              ))}
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
