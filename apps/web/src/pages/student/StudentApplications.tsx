import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBriefcase } from 'react-icons/fi';
import { format } from 'date-fns';
import { APPLICATION_STATUSES } from '@aip/config';
import type { ApplicationStatus } from '@aip/config';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import { Thead, Th, Tbody, Td } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import MatchBadge from '@/components/ui/MatchBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
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
  WITHDRAWAL_REQUESTED: { label: 'Withdrawal Requested', variant: 'warning' },
  OFFER_EXPIRED: { label: 'Offer Expired', variant: 'danger' },
};

const statusLabels: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Under Review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  SELECTED: 'Selected',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  INTERNSHIP_STARTED: 'Internship Started',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  OFFER_ACCEPTED: 'Offer Accepted',
  OFFER_REJECTED: 'Offer Declined',
  WITHDRAWAL_REQUESTED: 'Withdrawal Requested',
  OFFER_EXPIRED: 'Offer Expired',
};

export default function StudentApplications() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useApplications({
    status: statusFilter || undefined,
    page,
  });

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Applications" subtitle="Track all your submitted applications." />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setStatusFilter(''); setPage(1); }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !statusFilter
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          All
        </button>
        {APPLICATION_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {statusLabels[s]}
          </button>
        ))}
      </div>

      {isError && <ErrorState onRetry={() => void refetch()} />}

      {(isLoading || (data && data.items.length > 0)) && (
        <Table>
          <Thead>
            <tr>
              <Th>Opportunity</Th>
              <Th>Type</Th>
              <Th>Company</Th>
              <Th>Applied Date</Th>
              <Th>Status</Th>
              <Th>Match</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {isLoading && <SkeletonTableRows rows={5} cols={7} />}
            {data?.items.map((app) => {
              const cfg = statusConfig[app.status] ?? { label: app.status, variant: 'default' as BadgeVariant };
              return (
                <tr
                  key={app.id}
                  onClick={() => navigate(`/student/applications/${app.id}`)}
                  className="cursor-pointer"
                >
                  <Td>
                    <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{getOpportunityTitle(app)}</span>
                  </Td>
                  <Td>
                    <Badge variant="default" size="sm">{app.opportunityType}</Badge>
                  </Td>
                  <Td>{getCompanyName(app)}</Td>
                  <Td>{format(new Date(app.createdAt), 'MMM d, yyyy')}</Td>
                  <Td>
                    <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
                  </Td>
                  <Td>
                    {app.matchScore !== undefined ? (
                      <MatchBadge score={app.matchScore} />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); navigate(`/student/applications/${app.id}`); }}
                    >
                      View
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </Tbody>
        </Table>
      )}

      {data && data.items.length === 0 && !isLoading && (
        <EmptyState
          icon={<FiBriefcase />}
          title="No applications yet"
          description="Start applying to jobs and internships to track them here."
        />
      )}

      {data && data.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
