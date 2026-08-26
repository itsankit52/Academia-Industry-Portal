import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FiAward, FiCheckCircle, FiExternalLink, FiShare2, FiUser } from 'react-icons/fi';
import { format } from 'date-fns';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import SkillChip from '@/components/ui/SkillChip';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { usePublicPortfolio } from '@/hooks/queries/usePublicPortfolio';

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

  const { student, skills, projects, certifications, achievements, verifiedDocuments } = data;

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8 space-y-8">
      <Card>
        <Card.Body className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-2xl font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
              {student.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{student.fullName}</h1>
              {student.institution && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {student.institution.name} <span className="text-slate-400">·</span> {student.institution.code}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {student.degree && <Badge variant="info" size="sm">{student.degree}</Badge>}
                {student.branch && <Badge variant="default" size="sm">{student.branch}</Badge>}
                {student.graduationYear && (
                  <Badge variant="default" size="sm">Class of {student.graduationYear}</Badge>
                )}
              </div>
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
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">About</h2>
          <Card>
            <Card.Body>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{student.bio}</p>
            </Card.Body>
          </Card>
        </section>
      )}

      {skills.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">Skills</h2>
          <Card>
            <Card.Body>
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <SkillChip key={`${s.name}-${s.proficiency}`} name={s.name} />
                ))}
              </div>
            </Card.Body>
          </Card>
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
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Issued by {doc.issuer}</p>
                      )}
                    </div>
                    <Badge variant="success" size="sm">Verified</Badge>
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
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">Certifications</h2>
          <div className="space-y-2">
            {certifications.map((c, i) => (
              <Card key={`${c.title}-${i}`}>
                <Card.Body className="flex items-center gap-3">
                  <FiAward className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{c.issuer}</p>
                  </div>
                </Card.Body>
              </Card>
            ))}
          </div>
        </section>
      )}

      {projects.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projects.map((p, i) => (
              <Card key={`${p.title}-${i}`}>
                <Card.Body className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p.title}</p>
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
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{p.description}</p>
                </Card.Body>
              </Card>
            ))}
          </div>
        </section>
      )}

      {achievements.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">Achievements</h2>
          <div className="space-y-2">
            {achievements.map((a, i) => (
              <Card key={`${a.title}-${i}`}>
                <Card.Body>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{a.title}</p>
                  {a.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{a.description}</p>
                  )}
                  {a.date && (
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{format(new Date(a.date), 'MMM yyyy')}</p>
                  )}
                </Card.Body>
              </Card>
            ))}
          </div>
        </section>
      )}

      {skills.length === 0
        && verifiedDocuments.length === 0
        && certifications.length === 0
        && projects.length === 0
        && achievements.length === 0
        && !student.bio && (
        <EmptyState
          icon={<FiUser />}
          title="This portfolio is empty"
          description="The student has not shared any public information yet."
        />
      )}
    </div>
  );
}
