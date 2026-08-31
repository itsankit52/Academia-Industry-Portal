import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  FiAward,
  FiBookOpen,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
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
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { usePublicPortfolio } from '@/hooks/queries/usePublicPortfolio';

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

export default function PublicPortfolio() {
  const { studentId } = useParams<{ studentId: string }>();
  const { data, isLoading, isError, refetch } = usePublicPortfolio(studentId);
  const [copied, setCopied] = useState(false);

  function handleCopyLink() {
    void navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-6 sm:p-8 space-y-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-5xl mx-auto p-6 sm:p-8">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto p-6 sm:p-8">
        <EmptyState
          icon={<FiUser />}
          title="Portfolio not found"
          description="This student does not have a public portfolio, or the link is incorrect."
        />
      </div>
    );
  }

  const {
    student,
    skills,
    projects,
    certifications,
    achievements,
    verifiedDocuments,
    experience,
    internships,
  } = data;
  const initials = student.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const allEmpty =
    skills.length === 0 &&
    verifiedDocuments.length === 0 &&
    certifications.length === 0 &&
    projects.length === 0 &&
    achievements.length === 0 &&
    experience.length === 0 &&
    (!internships || internships.length === 0) &&
    !student.bio &&
    student.education.length === 0 &&
    student.languages.length === 0 &&
    student.softSkills.length === 0 &&
    !student.careerInterests;

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8 space-y-6">
      <Card>
        <Card.Body className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-2xl font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {student.fullName}
              </h1>
              {student.institution && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <FiBookOpen className="w-4 h-4" />
                  {student.institution.name}
                  <span className="text-slate-400">·</span>
                  {student.institution.code}
                </p>
              )}
              {(student.degree || student.branch) && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {[student.degree, student.branch].filter(Boolean).join(' · ')}
                </p>
              )}
              {(student.city || student.state) && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                  <FiMapPin className="w-3 h-3" />
                  {[student.city, student.state].filter(Boolean).join(', ')}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {student.degree && (
                  <Badge variant="info" size="sm">
                    {student.degree}
                  </Badge>
                )}
                {student.branch && (
                  <Badge variant="default" size="sm">
                    {student.branch}
                  </Badge>
                )}
                {student.graduationYear && (
                  <Badge variant="default" size="sm">
                    Class of {student.graduationYear}
                  </Badge>
                )}
                {student.cgpa !== undefined && (
                  <Badge variant="success" size="sm">
                    CGPA {student.cgpa}
                  </Badge>
                )}
              </div>
              {(student.linkedinUrl ||
                student.githubUrl ||
                student.portfolioUrl ||
                student.twitterUrl) && (
                <div className="mt-3 flex flex-wrap gap-4">
                  {student.linkedinUrl && (
                    <SocialLink
                      href={student.linkedinUrl}
                      label="LinkedIn"
                      icon={<FiLinkedin className="w-4 h-4" />}
                    />
                  )}
                  {student.githubUrl && (
                    <SocialLink
                      href={student.githubUrl}
                      label="GitHub"
                      icon={<FiGithub className="w-4 h-4" />}
                    />
                  )}
                  {student.portfolioUrl && (
                    <SocialLink
                      href={student.portfolioUrl}
                      label="Portfolio"
                      icon={<FiGlobe className="w-4 h-4" />}
                    />
                  )}
                  {student.twitterUrl && (
                    <SocialLink
                      href={student.twitterUrl}
                      label="Twitter"
                      icon={<FiTwitter className="w-4 h-4" />}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            iconLeft={<FiShare2 className="w-4 h-4" />}
            onClick={handleCopyLink}
          >
            {copied ? 'Link copied' : 'Copy Link'}
          </Button>
        </Card.Body>
      </Card>

      {student.bio && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
            About
          </h2>
          <Card>
            <Card.Body>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {student.bio}
              </p>
            </Card.Body>
          </Card>
        </section>
      )}

      {student.education.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <FiBookOpen className="w-4 h-4" /> Education
          </h2>
          <div className="space-y-2">
            {student.education.map((edu, i) => (
              <Card key={`${edu.institution}-${i}`}>
                <Card.Body>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {edu.degree}
                    {edu.field ? ` · ${edu.field}` : ''}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {edu.institution}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                    {edu.startYear ?? '—'} — {edu.endYear ?? 'Present'}
                    {edu.grade ? ` · ${edu.grade}` : ''}
                  </p>
                  {edu.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 whitespace-pre-wrap">
                      {edu.description}
                    </p>
                  )}
                </Card.Body>
              </Card>
            ))}
          </div>
        </section>
      )}

      {skills.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <FiStar className="w-4 h-4" /> Technical Skills
          </h2>
          <Card>
            <Card.Body>
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <Badge key={`${s.name}-${s.proficiency}`} variant="info" size="sm">
                    {s.name} {s.proficiency ? `· ${s.proficiency}` : ''}
                  </Badge>
                ))}
              </div>
            </Card.Body>
          </Card>
        </section>
      )}

      {student.softSkills.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
            Soft Skills
          </h2>
          <Card>
            <Card.Body>
              <div className="flex flex-wrap gap-2">
                {student.softSkills.map((s) => (
                  <Badge key={s} variant="default" size="sm">
                    {s}
                  </Badge>
                ))}
              </div>
            </Card.Body>
          </Card>
        </section>
      )}

      {student.careerInterests && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <FiTarget className="w-4 h-4" /> Career Interests
          </h2>
          <Card>
            <Card.Body>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {student.careerInterests}
              </p>
              {(student.preferredRoles.length > 0 || student.preferredLocations.length > 0) && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {student.preferredRoles.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                        Target Roles
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {student.preferredRoles.map((r) => (
                          <Badge key={r} variant="info" size="sm">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {student.preferredLocations.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Locations</p>
                      <div className="flex flex-wrap gap-1.5">
                        {student.preferredLocations.map((l) => (
                          <Badge key={l} variant="default" size="sm">
                            {l}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>
        </section>
      )}

      {student.languages.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <FiGlobe className="w-4 h-4" /> Languages
          </h2>
          <Card>
            <Card.Body>
              <div className="flex flex-wrap gap-1.5">
                {student.languages.map((l, i) => (
                  <Badge key={`${l.name}-${i}`} variant="default" size="sm">
                    {l.name}
                    {l.proficiency ? ` · ${l.proficiency}` : ''}
                  </Badge>
                ))}
              </div>
            </Card.Body>
          </Card>
        </section>
      )}

      {experience.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <FiBriefcase className="w-4 h-4" /> Internships & Experience
          </h2>
          <div className="space-y-2">
            {experience.map((exp, i) => (
              <Card key={`${exp.title}-${i}`}>
                <Card.Body>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {exp.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{exp.organization}</p>
                  {(exp.startDate || exp.endDate) && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {exp.startDate ? format(new Date(exp.startDate), 'MMM yyyy') : '—'} —{' '}
                      {exp.endDate ? format(new Date(exp.endDate), 'MMM yyyy') : 'Present'}
                    </p>
                  )}
                  {exp.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 whitespace-pre-wrap">
                      {exp.description}
                    </p>
                  )}
                </Card.Body>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Phase 14A: Portal-fetched completed/ongoing internships — distinct from manual experience */}
      {internships && internships.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <FiBriefcase className="w-4 h-4" /> Portal Internships
          </h2>
          <div className="space-y-2">
            {internships.map((internship) => (
              <Card key={internship.id}>
                <Card.Body className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {internship.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {internship.organization}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge
                        variant={internship.status === 'COMPLETED' ? 'success' : 'info'}
                        size="sm"
                      >
                        {internship.status === 'COMPLETED' ? 'Completed' : 'Ongoing'}
                      </Badge>
                      {internship.durationMonths && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <FiClock className="w-3 h-3" />
                          {internship.durationMonths} mo
                        </span>
                      )}
                    </div>
                  </div>
                  {(internship.startDate || internship.endDate) && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {internship.startDate
                        ? format(new Date(internship.startDate), 'MMM yyyy')
                        : '—'}{' '}
                      —{' '}
                      {internship.endDate
                        ? format(new Date(internship.endDate), 'MMM yyyy')
                        : 'Present'}
                    </p>
                  )}
                  {internship.skills && internship.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {internship.skills.slice(0, 6).map((s) => (
                        <Badge key={s} variant="default" size="sm">
                          {s}
                        </Badge>
                      ))}
                      {internship.skills.length > 6 && (
                        <Badge variant="default" size="sm">
                          +{internship.skills.length - 6}
                        </Badge>
                      )}
                    </div>
                  )}
                  {internship.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                      {internship.description}
                    </p>
                  )}
                </Card.Body>
              </Card>
            ))}
          </div>
        </section>
      )}

      {projects.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <FiStar className="w-4 h-4" /> Projects
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projects.map((p, i) => (
              <Card key={`${p.title}-${i}`}>
                <Card.Body className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {p.title}
                    </p>
                    {p.link && (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                        aria-label="Open project link"
                      >
                        <FiExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
                      {p.description}
                    </p>
                  )}
                </Card.Body>
              </Card>
            ))}
          </div>
        </section>
      )}

      {verifiedDocuments.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <FiCheckCircle className="w-4 h-4 text-emerald-600" /> Verified Documents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {verifiedDocuments.map((doc, i) => (
              <Card key={`${doc.title ?? doc.documentType}-${i}`}>
                <Card.Body className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {doc.title ?? doc.documentType.replace(/_/g, ' ')}
                      </p>
                      {doc.issuer && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          Issued by {doc.issuer}
                        </p>
                      )}
                    </div>
                    <Badge variant="success" size="sm">
                      Verified
                    </Badge>
                  </div>
                  {doc.verifiedBy && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Verified by {doc.verifiedBy}
                      {doc.verifiedAt && ` · ${format(new Date(doc.verifiedAt), 'MMM yyyy')}`}
                    </p>
                  )}
                </Card.Body>
              </Card>
            ))}
          </div>
        </section>
      )}

      {certifications.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <FiAward className="w-4 h-4" /> Certifications
          </h2>
          <div className="space-y-2">
            {certifications.map((c, i) => (
              <Card key={`${c.title}-${i}`}>
                <Card.Body className="flex items-center gap-3">
                  <FiAward className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {c.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{c.issuer}</p>
                  </div>
                </Card.Body>
              </Card>
            ))}
          </div>
        </section>
      )}

      {achievements.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <FiStar className="w-4 h-4" /> Achievements
          </h2>
          <div className="space-y-2">
            {achievements.map((a, i) => (
              <Card key={`${a.title}-${i}`}>
                <Card.Body>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {a.title}
                  </p>
                  {a.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {a.description}
                    </p>
                  )}
                  {a.date && (
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      {format(new Date(a.date), 'MMM yyyy')}
                    </p>
                  )}
                </Card.Body>
              </Card>
            ))}
          </div>
        </section>
      )}

      {allEmpty && (
        <EmptyState
          icon={<FiUser />}
          title="This portfolio is empty"
          description="The student has not shared any public information yet."
        />
      )}
    </div>
  );
}
