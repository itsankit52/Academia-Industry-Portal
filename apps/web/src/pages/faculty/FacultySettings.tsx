import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import ChangePasswordForm from '@/components/features/ChangePasswordForm';
import LinkGoogleAccount from '@/components/features/LinkGoogleAccount';

export default function FacultySettings() {
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
            Google Sign-In
          </h2>
        </Card.Header>
        <Card.Body className="max-w-md">
          <LinkGoogleAccount />
        </Card.Body>
      </Card>
    </div>
  );
}
