import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiX } from 'react-icons/fi';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonCard } from '@/components/ui/Skeleton';
import TimelineList from '@/components/features/TimelineList';
import { getCompanyName, getOpportunityTitle } from '@aip/types';
import { useFacultyApplication } from '@/hooks/queries/useFacultyApplications';
import { queryKeys } from '@/hooks/queries/queryKeys';
import { apiPatch } from '@/lib/api';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  APPLIED: { label: 'Applied', variant: 'info' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'warning' },
  SHORTLISTED: { label: 'Shortlisted', variant: 'success' },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', variant: 'success' },
  SELECTED: { label: 'Selected', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'default' },
  INTERNSHIP_STARTED: { label: 'Internship Started', variant: 'success' },
  ONGOING: { label: 'Ongoing', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  OFFER_ACCEPTED: { label: 'Offer Accepted', variant: 'success' },
};

const ENGAGEMENT_STATUSES = new Set(['SELECTED', 'INTERNSHIP_STARTED', 'ONGOING', 'COMPLETED']);

export function useWithdrawFacultyApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiPatch<void>(`/applications/${id}/withdraw`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.faculty.application(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.faculty.applications() });
      toast.success('Application withdrawn.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to withdraw application.');
    },
  });
}

export default function FacultyApplicationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showWithdraw, setShowWithdraw] = useState(false);

  const { data: application, isLoading, isError, refetch } = useFacultyApplication(id ?? '');
  const withdrawMut = useWithdrawFacultyApplication();

  const isWithdrawn = application?.status === 'WITHDRAWN';
  const showEngagement = application ? ENGAGEMENT_STATUSES.has(application.status) : false;

  function handleWithdraw() {
    if (!id) return;
    withdrawMut.mutate(id, {
      onSuccess: () => {
        setShowWithdraw(false);
        void refetch();
      },
    });
  }

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

  const selectedAt = (application as { selectedAt?: string }).selectedAt;
  const startedAt =
    (application as { startedAt?: string }).startedAt ??
    (application as { internshipStartedAt?: string }).internshipStartedAt;
  const completedAt =
    (application as { completedAt?: string }).completedAt ??
    (application as { internshipCompletedAt?: string }).internshipCompletedAt;

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
              onClick={() => navigate('/faculty/applications')}
            >
              Back
            </Button>
            {isWithdrawn && (
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<FiX className="w-4 h-4" />}
                onClick={() => setShowWithdraw(true)}
              >
                Withdraw
              </Button>
            )}
          </>
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

            {showEngagement && (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
                  Engagement
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {selectedAt && (
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                        Selected At
                      </p>
                      <p className="text-sm text-slate-800 dark:text-slate-200">
                        {format(new Date(selectedAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                  {startedAt && (
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                        Started At
                      </p>
                      <p className="text-sm text-slate-800 dark:text-slate-200">
                        {format(new Date(startedAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                  {completedAt && (
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                        Completed At
                      </p>
                      <p className="text-sm text-slate-800 dark:text-slate-200">
                        {format(new Date(completedAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

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

      <ConfirmDialog
        open={showWithdraw}
        title="Withdraw Application"
        description="Are you sure you want to withdraw this application? This action cannot be undone."
        confirmLabel="Withdraw"
        variant="danger"
        loading={withdrawMut.isPending}
        onConfirm={handleWithdraw}
        onCancel={() => setShowWithdraw(false)}
      />
    </div>
  );
}
