import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiFileText } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import MatchBadge from '@/components/ui/MatchBadge';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import SkillChip from '@/components/ui/SkillChip';
import ScheduleInterviewModal from '@/components/features/ScheduleInterviewModal';
import { useCandidateDetails, useUpdateApplicationStatus } from '@/hooks/queries/useCompanyApplicants';
import { useInterimReports } from '@/hooks/queries/useInterimReports';
import { useDownloadCertificate } from '@/hooks/queries/useDownloadCertificate';
import { format } from 'date-fns';
import type { ApplicationStatus } from '@aip/config';
import { getOpportunityTitle } from '@aip/types';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<ApplicationStatus, { label: string; variant: BadgeVariant }> = {
  APPLIED: { label: 'Applied', variant: 'info' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'warning' },
  SHORTLISTED: { label: 'Shortlisted', variant: 'success' },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', variant: 'success' },
  SELECTED: { label: 'Selected', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'default' },
};

export default function CompanyApplicantDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useCandidateDetails(id!);
  const updateStatus = useUpdateApplicationStatus();
  const reportsQ = useInterimReports(id ?? '');
  const downloadCert = useDownloadCertificate(id ?? '');
  const [scheduleOpen, setScheduleOpen] = useState(false);

  if (isError) return <ErrorState onRetry={refetch} />;
  if (isLoading) return (
    <div className="container-page py-8 space-y-4">
      <SkeletonCard className="h-32" />
      <SkeletonCard className="h-64" />
    </div>
  );

  const { application, studentProfile, matchedSkills = [], missingSkills = [] } = data!;
  const statusCfg = statusConfig[application.status];

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title={studentProfile.fullName}
        subtitle={`Applied for ${getOpportunityTitle(application)}`}
        actions={
          <>
            <Button variant="ghost" size="sm" iconLeft={<FiArrowLeft className="w-4 h-4" />} onClick={() => navigate('/company/applicants')}>
              Back
            </Button>
            {application.status === 'SELECTED' && (
              <Link
                to={`/company/applications/${application.id}/reports`}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 no-underline dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiFileText className="w-4 h-4" /> Interim Reports
              </Link>
            )}
            {application.status === 'SELECTED' && (reportsQ.data?.items.length ?? 0) > 0 && (
              <Button
                size="sm"
                iconLeft={<FiDownload className="w-4 h-4" />}
                loading={downloadCert.isPending}
                onClick={() => downloadCert.mutate()}
              >
                Download Certificate
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <Card.Body>
              <div className="flex items-center gap-4">
                <Avatar name={studentProfile.fullName} size="lg" />
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-slate-900 dark:text-slate-100">{studentProfile.fullName}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{studentProfile.email}</p>
                  {studentProfile.college && <p className="text-sm text-slate-500 dark:text-slate-400">{studentProfile.college}</p>}
                  {studentProfile.branch && <p className="text-xs text-slate-400 dark:text-slate-500">{studentProfile.branch} {studentProfile.cgpa ? `· CGPA ${studentProfile.cgpa}` : ''}</p>}
                </div>
                <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
              </div>
            </Card.Body>
          </Card>

          {application.matchScore != null && (
            <Card>
              <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Match Analysis</h3></Card.Header>
              <Card.Body className="space-y-3">
                <MatchBadge score={application.matchScore} />
                {matchedSkills.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Matched Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {matchedSkills.map((s) => <SkillChip key={s} name={s} className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" />)}
                    </div>
                  </div>
                )}
                {missingSkills.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Missing Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {missingSkills.map((s) => <SkillChip key={s} name={s} className="bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" />)}
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          {studentProfile.skills.length > 0 && (
            <Card>
              <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Skills</h3></Card.Header>
              <Card.Body>
                <div className="flex flex-wrap gap-1.5">
                  {studentProfile.skills.map((s) => (
                     <span key={s.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                      {s.name}
                      <span className="text-indigo-400 dark:text-indigo-500">· {s.proficiency}</span>
                    </span>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}

          {studentProfile.projects.length > 0 && (
            <Card>
              <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Projects</h3></Card.Header>
              <Card.Body className="space-y-4">
                {studentProfile.projects.map((p, i) => (
                   <div key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{p.title}</p>
                      {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600">View</a>}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{p.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {p.techStack.map((t) => <span key={t} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded">{t}</span>)}
                    </div>
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}

          {studentProfile.experience.length > 0 && (
            <Card>
              <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Experience</h3></Card.Header>
              <Card.Body className="space-y-3">
                {studentProfile.experience.map((e, i) => (
                   <div key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0 pb-3 last:pb-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{e.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{e.organization} · {format(new Date(e.startDate), 'MMM yyyy')} – {e.endDate ? format(new Date(e.endDate), 'MMM yyyy') : 'Present'}</p>
                    {e.description && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{e.description}</p>}
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}

          {application.coverLetter && (
            <Card>
              <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Cover Letter</h3></Card.Header>
              <Card.Body>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{application.coverLetter}</p>
              </Card.Body>
            </Card>
          )}

          <Card>
              <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Application Timeline</h3></Card.Header>
            <Card.Body>
              <ol className="relative border-l border-slate-200 dark:border-slate-700 space-y-4 ml-3">
                {application.timeline.map((t, i) => {
                  const cfg = statusConfig[t.status];
                  return (
                    <li key={i} className="ml-4">
                      <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900" />
                      <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{format(new Date(t.at), 'MMM d, yyyy h:mm a')}</p>
                      {t.note && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{t.note}</p>}
                    </li>
                  );
                })}
              </ol>
            </Card.Body>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Actions</h3></Card.Header>
            <Card.Body className="space-y-3">
              {application.status !== 'SHORTLISTED' && (
                <Button
                  className="w-full"
                  variant="secondary"
                  size="sm"
                  loading={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ id: application.id, status: 'SHORTLISTED' })}
                >
                  Shortlist
                </Button>
              )}
              <Button className="w-full" size="sm" onClick={() => setScheduleOpen(true)}>
                Schedule Interview
              </Button>
              {application.status !== 'REJECTED' && (
                <Button
                  className="w-full"
                  variant="danger"
                  size="sm"
                  loading={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ id: application.id, status: 'REJECTED' })}
                >
                  Reject
                </Button>
              )}
              {studentProfile.resumeUrl && (
                <a href={studentProfile.resumeUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full" variant="outline" size="sm" iconLeft={<FiDownload className="w-4 h-4" />}>
                    Download Resume
                  </Button>
                </a>
              )}
            </Card.Body>
          </Card>

          {studentProfile.resumeUrl && (
            <Card>
              <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Resume</h3></Card.Header>
              <Card.Body className="p-0">
                {studentProfile.resumeUrl.endsWith('.pdf') ? (
                  <iframe
                    src={studentProfile.resumeUrl}
                    title="Resume"
                    className="w-full h-80 rounded-b-xl"
                  />
                ) : (
                  <div className="px-6 py-4">
                    <a href={studentProfile.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-700">
                      Open Resume
                    </a>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </div>
      </div>

      <ScheduleInterviewModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        applicationId={application.id}
      />
    </div>
  );
}
