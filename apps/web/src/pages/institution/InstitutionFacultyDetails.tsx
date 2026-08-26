import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiUser } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useInstitutionFacultyMember } from '@/hooks/queries/useInstitutionAnalytics';

export default function InstitutionFacultyDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: faculty, isLoading, isError, refetch } = useInstitutionFacultyMember(id ?? '');

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (isError || !faculty) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/institution/faculty"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" />
          Back to Faculty
        </Link>
      </div>

      <PageHeader
        title={faculty.fullName}
        subtitle={`${faculty.designation} · ${faculty.department}`}
        actions={
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <FiUser className="w-5 h-5" />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Professional Details
              </h2>
            </Card.Header>
            <Card.Body>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {[
                  { label: 'Designation', value: faculty.designation },
                  { label: 'Department', value: faculty.department },
                  { label: 'Employee Code', value: faculty.employeeCode },
                  { label: 'City', value: faculty.city },
                  { label: 'State', value: faculty.state },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">
                      {label}
                    </dt>
                    <dd className="text-slate-900 dark:text-slate-100">{value ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </Card.Body>
          </Card>

          {faculty.bio && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Bio</h2>
              </Card.Header>
              <Card.Body>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{faculty.bio}</p>
              </Card.Body>
            </Card>
          )}

          {faculty.qualifications.length > 0 && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Qualifications ({faculty.qualifications.length})
                </h2>
              </Card.Header>
              <Card.Body className="space-y-2">
                {faculty.qualifications.map((q, i) => (
                  <p key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">•</span>
                    {q}
                  </p>
                ))}
              </Card.Body>
            </Card>
          )}

          {faculty.researchInterests.length > 0 && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Research Interests ({faculty.researchInterests.length})
                </h2>
              </Card.Header>
              <Card.Body>
                <div className="flex flex-wrap gap-2">
                  {faculty.researchInterests.map((r) => (
                    <Badge key={r} variant="info">{r}</Badge>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Contact
              </h2>
            </Card.Header>
            <Card.Body className="space-y-3 text-sm">
              {[
                { label: 'Email', value: faculty.user?.email },
                { label: 'Phone', value: faculty.phone },
                { label: 'Gender', value: faculty.gender },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{label}</span>
                  <span className="text-slate-900 dark:text-slate-100 font-medium">{value ?? '—'}</span>
                </div>
              ))}
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
}
