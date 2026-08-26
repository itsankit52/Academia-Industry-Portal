import { Link } from 'react-router-dom';
import { FiEdit2, FiExternalLink } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useStudentProfile } from '@/hooks/queries/useStudentProfile';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-5">
      <Card.Header>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{title}</h2>
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

export default function StudentProfile() {
  const { data: profile, isLoading, isError, refetch } = useStudentProfile();

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Your academic and professional information."
        actions={
          <Link to="/student/profile/edit">
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
          <Section title="Personal Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full Name" value={profile.fullName} />
              <Field label="Phone" value={profile.phone} />
              <Field
                label="Date of Birth"
                value={profile.dob ? format(new Date(profile.dob), 'MMM d, yyyy') : undefined}
              />
              <Field label="Gender" value={profile.gender} />
              <Field label="City" value={profile.city} />
              <Field label="State" value={profile.state} />
              <Field label="Address" value={profile.address} />
            </div>
            {profile.bio && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Bio</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{profile.bio}</p>
              </div>
            )}
          </Section>

          <Section title="Academic Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="College" value={profile.college} />
              <Field label="University" value={profile.university} />
              <Field label="Degree" value={profile.degree} />
              <Field label="Branch" value={profile.branch} />
              <Field label="Semester" value={profile.semester} />
              <Field label="Graduation Year" value={profile.graduationYear} />
              <Field label="CGPA" value={profile.cgpa} />
            </div>
          </Section>

          <Section title="Professional Information">
            {profile.preferredRoles.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Preferred Roles</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.preferredRoles.map((r) => (
                    <Badge key={r} variant="info" size="sm">{r}</Badge>
                  ))}
                </div>
              </div>
            )}
            {profile.preferredLocations.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Preferred Locations</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.preferredLocations.map((l) => (
                    <Badge key={l} variant="default" size="sm">{l}</Badge>
                  ))}
                </div>
              </div>
            )}
            {profile.experience.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Experience</p>
                <div className="space-y-3">
                  {profile.experience.map((exp, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{exp.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{exp.organization}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {format(new Date(exp.startDate), 'MMM yyyy')} —{' '}
                        {exp.endDate ? format(new Date(exp.endDate), 'MMM yyyy') : 'Present'}
                      </p>
                      {exp.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {profile.projects.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Projects</p>
                <div className="space-y-3">
                  {profile.projects.map((proj, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{proj.title}</p>
                        {proj.link && (
                          <a
                            href={proj.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-700"
                            aria-label="Project link"
                          >
                            <FiExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                       <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{proj.description}</p>
                      {proj.techStack.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {proj.techStack.map((t) => (
                            <Badge key={t} variant="default" size="sm">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {profile.certifications.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Certifications</p>
                <div className="space-y-3">
                  {profile.certifications.map((cert, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{cert.title}</p>
                        {cert.credentialUrl && (
                          <a
                            href={cert.credentialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-700"
                            aria-label="Credential link"
                          >
                            <FiExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{cert.issuer}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {format(new Date(cert.issuedAt), 'MMM yyyy')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {profile.achievements.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Achievements</p>
                <div className="space-y-3">
                  {profile.achievements.map((ach, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{ach.title}</p>
                      {ach.date && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {format(new Date(ach.date), 'MMM yyyy')}
                        </p>
                      )}
                      {ach.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{ach.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
