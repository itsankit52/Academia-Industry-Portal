import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import TimelineList from '@/components/features/TimelineList';
import { getCompanyName, getOpportunityTitle } from '@aip/types';
import { useFacultyApplication } from '@/hooks/queries/useFacultyApplications';

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

export default function FacultyApplicationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: application, isLoading, isError, refetch } = useFacultyApplication(id ?? '');

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

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Application Details"
        subtitle={getOpportunityTitle(application)}
        actions={
          <Button
            variant="outline"
            size="sm"
            iconLeft={<FiArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/faculty/applications')}
          >
            Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <Card>
          <Card.Header>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Overview
            </h2>
          </Card.Header>
          <Card.Body className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={cfg.variant}>{cfg.label}</Badge>
              <Badge variant="default" size="sm">
                {application.opportunityType}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Host</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {getCompanyName(application)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Applied On</p>
                <p className="text-sm text-slate-800 dark:text-slate-200">
                  {format(new Date(application.createdAt), 'MMM d, yyyy')}
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
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Timeline
            </h2>
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
    </div>
  );
}
