import { Link } from 'react-router-dom';
import {
  FiAward,
  FiBookOpen,
  FiBriefcase,
  FiCode,
  FiEdit2,
  FiExternalLink,
  FiFile,
  FiGithub,
  FiGlobe,
  FiLinkedin,
  FiMapPin,
  FiShare2,
  FiStar,
  FiTarget,
  FiTwitter,
  FiUser,
} from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useStudentProfile } from '@/hooks/queries/useStudentProfile';

function ProfileSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-5">
      <Card.Header>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
          {icon}
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

function SocialLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
      aria-label={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </a>
  );
}

export default function StudentProfile() {
  const { data: profile, isLoading, isError, refetch } = useStudentProfile();

  if (isError) {
    return (
      <div className="container-page py-8 space-y-6">
        <PageHeader
          title="My Profile"
          subtitle="Your digital employability portfolio."
          actions={
            <Link to="/student/profile/edit">
              <Button size="sm" iconLeft={<FiEdit2 className="w-4 h-4" />}>
                Edit Profile
              </Button>
            </Link>
          }
        />
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-6">
        <PageHeader title="My Profile" subtitle="Your digital employability portfolio." />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container-page py-8 space-y-6">
        <PageHeader title="My Profile" subtitle="Your digital employability portfolio." />
        <EmptyState
          icon={<FiUser />}
          title="No profile found"
          description="Create your portfolio to showcase your skills, projects and achievements."
          action={{
            label: 'Build my profile',
            onClick: () => {
              window.location.href = '/student/profile/edit';
            },
          }}
        />
      </div>
    );
  }

  const shareUrl = `${window.location.origin}/portfolio/${profile.id}`;
  const initials = profile.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Your digital employability portfolio."
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={shareUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" iconLeft={<FiShare2 className="w-4 h-4" />}>
                View Public
              </Button>
            </a>
            <Link to="/student/profile/edit">
              <Button size="sm" iconLeft={<FiEdit2 className="w-4 h-4" />}>
                Edit Profile
              </Button>
            </Link>
          </div>
        }
      />

      {/* Hero card: identity */}
      <Card>
        <Card.Body className="flex flex-col sm:flex-row items-start gap-4">
          <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-2xl font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {profile.fullName}
            </h1>
            {(profile.degree || profile.branch) && (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                {[profile.degree, profile.branch].filter(Boolean).join(' · ')}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              {profile.college && (
                <span className="flex items-center gap-1">
                  <FiBookOpen className="w-4 h-4" />
                  {profile.college}
                </span>
              )}
              {profile.city && (
                <span className="flex items-center gap-1">
                  <FiMapPin className="w-4 h-4" />
                  {[profile.city, profile.state].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.graduationYear && (
                <Badge variant="info" size="sm">
                  Class of {profile.graduationYear}
                </Badge>
              )}
              {profile.cgpa !== undefined && (
                <Badge variant="success" size="sm">
                  CGPA {profile.cgpa}
                </Badge>
              )}
              {profile.semester !== undefined && (
                <Badge variant="default" size="sm">
                  Semester {profile.semester}
                </Badge>
              )}
            </div>
            {(profile.linkedinUrl ||
              profile.githubUrl ||
              profile.portfolioUrl ||
              profile.twitterUrl) && (
              <div className="mt-3 flex flex-wrap gap-4">
                {profile.linkedinUrl && (
                  <SocialLink
                    href={profile.linkedinUrl}
                    label="LinkedIn"
                    icon={<FiLinkedin className="w-4 h-4" />}
                  />
                )}
                {profile.githubUrl && (
                  <SocialLink
                    href={profile.githubUrl}
                    label="GitHub"
                    icon={<FiGithub className="w-4 h-4" />}
                  />
                )}
                {profile.portfolioUrl && (
                  <SocialLink
                    href={profile.portfolioUrl}
                    label="Portfolio"
                    icon={<FiGlobe className="w-4 h-4" />}
                  />
                )}
                {profile.twitterUrl && (
                  <SocialLink
                    href={profile.twitterUrl}
                    label="Twitter"
                    icon={<FiTwitter className="w-4 h-4" />}
                  />
                )}
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      {profile.bio && (
        <ProfileSection title="About" icon={<FiUser className="w-4 h-4" />}>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {profile.bio}
          </p>
        </ProfileSection>
      )}

      <ProfileSection title="Personal Information" icon={<FiUser className="w-4 h-4" />}>
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
      </ProfileSection>

      <ProfileSection title="Education" icon={<FiBookOpen className="w-4 h-4" />}>
        {profile.education.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No education entries yet. Add your academic history in Edit Profile.
          </p>
        ) : (
          <div className="space-y-3">
            {profile.education.map((edu, i) => (
              <div
                key={`${edu.institution}-${i}`}
                className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {edu.degree}
                  {edu.field ? ` · ${edu.field}` : ''}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {edu.institution}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {edu.startYear ?? '—'} — {edu.endYear ?? 'Present'}
                  {edu.grade ? ` · ${edu.grade}` : ''}
                </p>
                {edu.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 whitespace-pre-wrap">
                    {edu.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="Department & CGPA" icon={<FiAward className="w-4 h-4" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="College" value={profile.college} />
          <Field label="University" value={profile.university} />
          <Field label="Degree" value={profile.degree} />
          <Field label="Branch" value={profile.branch} />
          <Field label="Semester" value={profile.semester} />
          <Field label="Graduation Year" value={profile.graduationYear} />
          <Field label="CGPA" value={profile.cgpa} />
        </div>
      </ProfileSection>

      <ProfileSection title="Technical Skills" icon={<FiCode className="w-4 h-4" />}>
        {profile.preferredRoles.length === 0 && profile.softSkills.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Add skills you want to highlight.{' '}
            <Link to="/student/skills" className="text-indigo-600 hover:underline">
              Manage skills
            </Link>
          </p>
        ) : (
          <>
            {profile.preferredRoles.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                  Technical & Tools
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.preferredRoles.map((r) => (
                    <Badge key={r} variant="info" size="sm">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {profile.softSkills.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Soft Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.softSkills.map((s) => (
                    <Badge key={s} variant="default" size="sm">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </ProfileSection>

      <ProfileSection title="Career Interests" icon={<FiTarget className="w-4 h-4" />}>
        {profile.careerInterests ? (
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {profile.careerInterests}
          </p>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Describe the roles, industries, and problems you want to work on.
          </p>
        )}
        {profile.preferredLocations.length > 0 && (
          <div className="pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Preferred Locations</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.preferredLocations.map((l) => (
                <Badge key={l} variant="default" size="sm">
                  {l}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="Languages" icon={<FiGlobe className="w-4 h-4" />}>
        {profile.languages.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No languages added.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {profile.languages.map((l, i) => (
              <Badge key={`${l.name}-${i}`} variant="default" size="sm">
                {l.name}
                {l.proficiency ? ` · ${l.proficiency}` : ''}
              </Badge>
            ))}
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="Internships & Experience" icon={<FiBriefcase className="w-4 h-4" />}>
        {profile.experience.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Add internships, freelance work, or part-time roles to strengthen your portfolio.
          </p>
        ) : (
          <div className="space-y-3">
            {profile.experience.map((exp, i) => (
              <div
                key={`${exp.title}-${i}`}
                className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {exp.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{exp.organization}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {exp.startDate ? format(new Date(exp.startDate), 'MMM yyyy') : '—'} —{' '}
                  {exp.endDate ? format(new Date(exp.endDate), 'MMM yyyy') : 'Present'}
                </p>
                {exp.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 whitespace-pre-wrap">
                    {exp.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="Projects" icon={<FiStar className="w-4 h-4" />}>
        {profile.projects.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showcase your best projects with descriptions, tech stack, and links.
          </p>
        ) : (
          <div className="space-y-3">
            {profile.projects.map((proj, i) => (
              <div
                key={`${proj.title}-${i}`}
                className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {proj.title}
                  </p>
                  {proj.link && (
                    <a
                      href={proj.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      aria-label={`Open ${proj.title}`}
                    >
                      <FiExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                {proj.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 whitespace-pre-wrap">
                    {proj.description}
                  </p>
                )}
                {proj.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {proj.techStack.map((t) => (
                      <Badge key={t} variant="default" size="sm">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="Certifications" icon={<FiAward className="w-4 h-4" />}>
        {profile.certifications.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Add professional certifications to validate your skills.
          </p>
        ) : (
          <div className="space-y-3">
            {profile.certifications.map((cert, i) => (
              <div
                key={`${cert.title}-${i}`}
                className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {cert.title}
                  </p>
                  {cert.credentialUrl && (
                    <a
                      href={cert.credentialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      aria-label="Open credential"
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
        )}
      </ProfileSection>

      <ProfileSection title="Achievements" icon={<FiStar className="w-4 h-4" />}>
        {profile.achievements.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Add awards, hackathon wins, and recognitions.
          </p>
        ) : (
          <div className="space-y-3">
            {profile.achievements.map((ach, i) => (
              <div
                key={`${ach.title}-${i}`}
                className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {ach.title}
                </p>
                {ach.date && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {format(new Date(ach.date), 'MMM yyyy')}
                  </p>
                )}
                {ach.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 whitespace-pre-wrap">
                    {ach.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </ProfileSection>

      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
            <FiFile className="w-4 h-4" /> Resume & Documents
          </h2>
        </Card.Header>
        <Card.Body className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Manage your resume and supporting documents (certificates, transcripts, internship
            reports).
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/student/resume">
              <Button size="sm" variant="outline">
                Resume
              </Button>
            </Link>
            <Link to="/student/documents">
              <Button size="sm" variant="outline">
                Documents
              </Button>
            </Link>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
