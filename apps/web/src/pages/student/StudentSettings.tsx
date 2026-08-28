import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import ChangePasswordForm from '@/components/features/ChangePasswordForm';

interface EmailPreferences {
  emailOnStatusChange: boolean;
  emailOnNewMatch: boolean;
  emailOnInterview: boolean;
}

const PREF_KEY = 'student_email_preferences';

function loadPrefs(): EmailPreferences {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) return JSON.parse(raw) as EmailPreferences;
  } catch {
    // Local storage may be unavailable (private mode, sandboxed iframe, etc.):
    // fall through to the default rather than failing the whole render.
  }
  return {
    emailOnStatusChange: true,
    emailOnNewMatch: true,
    emailOnInterview: true,
  };
}

export default function StudentSettings() {
  const [prefs, setPrefs] = useState<EmailPreferences>(loadPrefs);

  useEffect(() => {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }, [prefs]);

  function togglePref(key: keyof EmailPreferences) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Settings" subtitle="Manage your account preferences." />

      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Change Password
          </h2>
        </Card.Header>
        <Card.Body className="max-w-md">
          <ChangePasswordForm />
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Email Preferences
          </h2>
        </Card.Header>
        <Card.Body className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Choose which email notifications you'd like to receive.
          </p>

          {(
            [
              {
                key: 'emailOnStatusChange' as const,
                label: 'Application status changes',
                description: 'Get notified when your application status is updated.',
              },
              {
                key: 'emailOnNewMatch' as const,
                label: 'New job/internship matches',
                description: 'Receive emails when new opportunities match your profile.',
              },
              {
                key: 'emailOnInterview' as const,
                label: 'Interview scheduled',
                description: 'Get notified when an interview is scheduled for you.',
              },
            ] satisfies { key: keyof EmailPreferences; label: string; description: string }[]
          ).map(({ key, label, description }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={() => togglePref(key)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-slate-100">
                  {label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
              </div>
            </label>
          ))}
        </Card.Body>
      </Card>
    </div>
  );
}
