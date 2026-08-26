import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiUser } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useInstitutionStudent } from '@/hooks/queries/useInstitutionAnalytics';

export default function InstitutionStudentDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: student, isLoading, isError, refetch } = useInstitutionStudent(id ?? '');

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (isError || !student) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/institution/students"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" />
          Back to Students
        </Link>
      </div>

      <PageHeader
        title={student.fullName}
        subtitle={student.user?.email}
        actions={
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FiUser className="w-5 h-5" />
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Academic Information
              </h2>
            </Card.Header>
            <Card.Body>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {[
                  { label: 'College', value: student.college },
                  { label: 'University', value: student.university },
                  { label: 'Degree', value: student.degree },
                  { label: 'Branch', value: student.branch },
                  { label: 'Semester', value: student.semester },
                  { label: 'Graduation Year', value: student.graduationYear },
                  { label: 'CGPA', value: student.cgpa != null ? student.cgpa.toFixed(2) : undefined },
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

          {student.bio && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Bio
                </h2>
              </Card.Header>
              <Card.Body>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{student.bio}</p>
              </Card.Body>
            </Card>
          )}

          {student.projects.length > 0 && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Projects ({student.projects.length})
                </h2>
              </Card.Header>
              <Card.Body className="space-y-4">
                {student.projects.map((p, i) => (
                  <div key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0 pb-4 last:pb-0">
                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{p.title}</p>
                    {p.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{p.description}</p>
                    )}
                    {p.techStack.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.techStack.map((t) => (
                          <Badge key={t} size="sm">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}

          {student.certifications.length > 0 && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Certifications ({student.certifications.length})
                </h2>
              </Card.Header>
              <Card.Body className="space-y-3">
                {student.certifications.map((c, i) => (
                  <div key={i} className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{c.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{c.issuer}</p>
                    </div>
                    {c.issuedAt && (
                      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 ml-4">
                        {new Date(c.issuedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Personal Details
              </h2>
            </Card.Header>
            <Card.Body className="space-y-3 text-sm">
              {[
                { label: 'Email', value: student.user?.email },
                { label: 'Phone', value: student.phone },
                { label: 'Gender', value: student.gender },
                { label: 'City', value: student.city },
                { label: 'State', value: student.state },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{label}</span>
                  <span className="text-slate-900 dark:text-slate-100 font-medium">{value ?? '—'}</span>
                </div>
              ))}
            </Card.Body>
          </Card>

          {(student.preferredRoles.length > 0 || student.preferredLocations.length > 0) && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Preferences
                </h2>
              </Card.Header>
              <Card.Body className="space-y-3">
                {student.preferredRoles.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Preferred Roles</p>
                    <div className="flex flex-wrap gap-1">
                      {student.preferredRoles.map((r) => <Badge key={r} size="sm">{r}</Badge>)}
                    </div>
                  </div>
                )}
                {student.preferredLocations.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Preferred Locations</p>
                    <div className="flex flex-wrap gap-1">
                      {student.preferredLocations.map((l) => <Badge key={l} size="sm">{l}</Badge>)}
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
