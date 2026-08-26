import { Link } from 'react-router-dom';
import { FiEdit2 } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useFacultyProfile } from '@/hooks/queries/useFacultyProfile';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-5">
      <Card.Header>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
          {title}
        </h2>
      </Card.Header>
      <Card.Body className="space-y-3">{children}</Card.Body>
    </Card>
  );
}

function Field({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 dark:text-slate-200">{String(value)}</p>
    </div>
  );
}

export default function FacultyProfile() {
  const { data: profile, isLoading, isError, refetch } = useFacultyProfile();

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Your academic and professional information."
        actions={
          <Link to="/faculty/profile/edit">
            <Button size="sm" iconLeft={<FiEdit2 className="w-4 h-4" />}>
              Edit Profile
            </Button>
          </Link>
        }
      />

      {isError && <ErrorState onRetry={() => void refetch()} />}

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {profile && (
        <>
          <Section title="Personal">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full Name" value={profile.fullName} />
              <Field label="Designation" value={profile.designation} />
              <Field label="Department" value={profile.department} />
              <Field label="Institution" value={profile.institution} />
              <Field label="Phone" value={profile.phone} />
              <Field label="City" value={profile.city} />
              <Field label="State" value={profile.state} />
            </div>
            {profile.bio && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Bio</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </div>
            )}
          </Section>

          <Section title="Qualifications">
            {profile.qualifications.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No qualifications listed.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {profile.qualifications.map((q) => (
                  <Badge key={q} variant="info" size="sm">
                    {q}
                  </Badge>
                ))}
              </div>
            )}
          </Section>

          <Section title="Research Interests">
            {profile.researchInterests.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No research interests listed.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {profile.researchInterests.map((r) => (
                  <Badge key={r} variant="default" size="sm">
                    {r}
                  </Badge>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
