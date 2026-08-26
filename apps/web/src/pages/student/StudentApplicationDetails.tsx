import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiArrowLeft, FiExternalLink } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import MatchBadge from '@/components/ui/MatchBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import TimelineList from '@/components/features/TimelineList';
import { useApplication } from '@/hooks/queries/useApplication';
import { useWithdrawApplication } from '@/hooks/queries/useWithdrawApplication';
import { useInterimReports } from '@/hooks/queries/useInterimReports';
import { useDownloadCertificate } from '@/hooks/queries/useDownloadCertificate';
import { FiDownload, FiFileText } from 'react-icons/fi';
import { getOpportunityTitle, getCompanyName, getOpportunityId, getResumeUrl } from '@aip/types';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  APPLIED: { label: 'Applied', variant: 'info' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'warning' },
  SHORTLISTED: { label: 'Shortlisted', variant: 'success' },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', variant: 'success' },
  SELECTED: { label: 'Selected', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'default' },
};

const TERMINAL_STATUSES = new Set(['SELECTED', 'REJECTED', 'WITHDRAWN']);

export default function StudentApplicationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showWithdraw, setShowWithdraw] = useState(false);

  const { data: application, isLoading, isError, refetch } = useApplication(id ?? '');
  const withdraw = useWithdrawApplication();
  const reportsQ = useInterimReports(id ?? '');
  const downloadCert = useDownloadCertificate(id ?? '');

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError || !application) {
    return (
      <div className="container-page py-8">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  const cfg = statusConfig[application.status] ?? {
    label: application.status,
    variant: 'default' as BadgeVariant,
  };
  const canWithdraw = !TERMINAL_STATUSES.has(application.status);

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Application Details"
        subtitle={getOpportunityTitle(application)}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<FiArrowLeft className="w-4 h-4" />}
              onClick={() => navigate('/student/applications')}
            >
              Back
            </Button>
            {application.status === 'SELECTED' && (
              <Link
                to={`/student/applications/${application.id}/reports`}
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-4">
          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Overview</h2>
            </Card.Header>
            <Card.Body className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
                {application.matchScore !== undefined && (
                  <MatchBadge score={application.matchScore} />
                )}
                <Badge variant="default" size="sm">{application.opportunityType}</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Company</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{getCompanyName(application)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Applied On</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    {format(new Date(application.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Last Updated</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    {format(new Date(application.updatedAt), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>

              {application.coverLetter && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Cover Letter</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    {application.coverLetter}
                  </p>
                </div>
              )}

              {getResumeUrl(application) && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Resume</p>
                  <a
                    href={getResumeUrl(application)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium no-underline"
                  >
                    View Resume <FiExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {canWithdraw && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowWithdraw(true)}
                  >
                    Withdraw Application
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Opportunity
              </h2>
            </Card.Header>
            <Card.Body>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{getOpportunityTitle(application)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{getCompanyName(application)}</p>
                </div>
                <Link
                  to={`/student/${application.opportunityType === 'JOB' ? 'jobs' : 'internships'}/${getOpportunityId(application)}`}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium no-underline shrink-0"
                >
                  View <FiExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </Card.Body>
          </Card>
        </div>

        <Card>
          <Card.Header>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Timeline</h2>
          </Card.Header>
          <Card.Body>
            {application.timeline.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No status changes yet.</p>
            ) : (
              <TimelineList timeline={application.timeline} />
            )}
          </Card.Body>
        </Card>
      </div>

      <ConfirmDialog
        open={showWithdraw}
        title="Withdraw Application"
        description="Are you sure you want to withdraw this application? This action cannot be undone."
        confirmLabel="Withdraw"
        variant="danger"
        loading={withdraw.isPending}
        onConfirm={() =>
          withdraw.mutate(application.id, {
            onSuccess: () => {
              setShowWithdraw(false);
              navigate('/student/applications');
            },
          })
        }
        onCancel={() => setShowWithdraw(false)}
      />
    </div>
  );
}
