import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBook, FiArrowRight } from 'react-icons/fi';
import { format } from 'date-fns';
import { APPLICATION_STATUSES } from '@aip/config';
import type { ApplicationStatus } from '@aip/config';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import MatchBadge from '@/components/ui/MatchBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import { useApplications } from '@/hooks/queries/useApplications';
import { getOpportunityTitle, getCompanyName } from '@aip/types';

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
  OFFER_REJECTED: { label: 'Offer Declined', variant: 'danger' },
};

// Status order for the filter chips (internship lifecycle)
const LIFECYCLE_STATUSES: ApplicationStatus[] = [
  'APPLIED',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'SELECTED',
  'INTERNSHIP_STARTED',
  'ONGOING',
  'COMPLETED',
];

export default function StudentMyInternships() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useApplications({
    status: statusFilter || undefined,
    opportunityType: 'INTERNSHIP',
    page,
  });

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="My Internships"
        subtitle="Track your internship applications and lifecycle."
      />

      {/* Lifecycle status filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setStatusFilter('');
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !statusFilter
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          All
        </button>
        {LIFECYCLE_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {statusConfig[s]?.label ?? s}
          </button>
        ))}
      </div>

      {isError && <ErrorState onRetry={() => void refetch()} />}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {data && data.items.length === 0 && !isLoading && (
        <EmptyState
          icon={<FiBook />}
          title="No internships found"
          description={
            statusFilter
              ? `No internships with status "${statusConfig[statusFilter]?.label ?? statusFilter}".`
              : 'Start applying to internships to track them here.'
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.items.map((app) => {
              const cfg = statusConfig[app.status] ?? {
                label: app.status,
                variant: 'default' as BadgeVariant,
              };
              return (
                <Card key={app.id} className="hover:shadow-md transition-shadow">
                  <Card.Body>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {getOpportunityTitle(app)}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {getCompanyName(app)}
                        </p>
                      </div>
                      <Badge variant={cfg.variant} size="sm">
                        {cfg.label}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Applied:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {format(new Date(app.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                      {app.selectedAt && (
                        <div className="flex justify-between">
                          <span>Selected:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {format(new Date(app.selectedAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                      {app.startDate && (
                        <div className="flex justify-between">
                          <span>Start Date:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {format(new Date(app.startDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                      {app.expectedEndDate && (
                        <div className="flex justify-between">
                          <span>Expected End:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {format(new Date(app.expectedEndDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                      {app.startedAt && (
                        <div className="flex justify-between">
                          <span>Started:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {format(new Date(app.startedAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      {app.matchScore !== undefined && (
                        <MatchBadge score={app.matchScore} />
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        iconRight={<FiArrowRight className="w-3.5 h-3.5" />}
                        onClick={() => navigate(`/student/applications/${app.id}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              );
            })}
          </div>

          {data.totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
