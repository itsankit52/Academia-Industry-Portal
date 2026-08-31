import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiBriefcase, FiActivity, FiExternalLink } from 'react-icons/fi';
import { format } from 'date-fns';
import { APPLICATION_STATUSES } from '@aip/config';
import type { ApplicationStatus } from '@aip/config';
import { getCompanyName, getOpportunityTitle } from '@aip/types';
import PageHeader from '@/components/ui/PageHeader';
import Table, { Tbody, Td, Th, Thead } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import Tabs from '@/components/ui/Tabs';
import { useFacultyApplications } from '@/hooks/queries/useFacultyApplications';
import { useFacultyEngagements } from '@/hooks/queries/useFacultyEngagements';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<ApplicationStatus, { label: string; variant: BadgeVariant }> = {
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
  WITHDRAWAL_REQUESTED: 'Withdrawal Requested',
  INTERNSHIP_STARTED: 'Internship Started',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  OFFER_ACCEPTED: 'Offer Accepted',
  OFFER_REJECTED: 'Offer Declined',
  OFFER_EXPIRED: 'Offer Expired',
};

const engagementStatusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'default' },
  ONGOING: { label: 'Ongoing', variant: 'success' },
  PAUSED: { label: 'Paused', variant: 'warning' },
  TERMINATED: { label: 'Terminated', variant: 'danger' },
  PENDING: { label: 'Pending', variant: 'info' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  SUSPENDED: { label: 'Suspended', variant: 'warning' },
};

export default function FacultyApplications() {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState<string>('APPLICATIONS');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [engagementPage, setEngagementPage] = useState(1);

  const { data, isLoading, isError, refetch } = useFacultyApplications({
    status: statusFilter || undefined,
    page,
  });

  const {
    data: engagementsData,
    isLoading: isEngagementsLoading,
    isError: isEngagementsError,
    refetch: refetchEngagements,
  } = useFacultyEngagements({
    tab: 'ALL',
    page: engagementPage,
    pageSize: 12,
  });

  const engagements = engagementsData?.items ?? [];

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="My Applications"
        subtitle="Track applications to faculty opportunities."
        actions={
          <Link
            to="/faculty/engagements"
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 no-underline dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FiExternalLink className="w-3.5 h-3.5" />
            View Engagements
          </Link>
        }
      />

      <Tabs value={mainTab} onChange={setMainTab}>
        <Tabs.List>
          <Tabs.Tab value="APPLICATIONS" label="All Applications" />
          <Tabs.Tab value="ENGAGEMENTS" label="Engagements" />
        </Tabs.List>

        <Tabs.Panels className="mt-6 space-y-6">
          <Tabs.Panel value="APPLICATIONS">
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
              {APPLICATION_STATUSES.map((s) => (
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
                    <Th>Host</Th>
                    <Th>Applied</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {isLoading && <SkeletonTableRows rows={5} cols={6} />}
                  {data?.items.map((app) => {
                    const cfg = statusConfig[app.status] ?? {
                      label: app.status,
                      variant: 'default' as BadgeVariant,
                    };
                    return (
                      <tr
                        key={app.id}
                        onClick={() => navigate(`/faculty/applications/${app.id}`)}
                        className="cursor-pointer"
                      >
                        <Td>
                          <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                            {getOpportunityTitle(app)}
                          </span>
                        </Td>
                        <Td>
                          <Badge variant="default" size="sm">
                            {app.opportunityType}
                          </Badge>
                        </Td>
                        <Td>{getCompanyName(app)}</Td>
                        <Td>{format(new Date(app.createdAt), 'MMM d, yyyy')}</Td>
                        <Td>
                          <Badge variant={cfg.variant} size="sm">
                            {cfg.label}
                          </Badge>
                        </Td>
                        <Td>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/faculty/applications/${app.id}`);
                            }}
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
                description="Browse opportunities and apply to see them here."
              />
            )}

            {data && data.totalPages > 1 && (
              <div className="flex justify-center">
                <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
              </div>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="ENGAGEMENTS">
            {isEngagementsError && <ErrorState onRetry={() => void refetchEngagements()} />}

            {!isEngagementsLoading && !isEngagementsError && engagements.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {engagements.map((engagement) => {
                  const cfg = engagementStatusConfig[engagement.status] ?? {
                    label: engagement.status,
                    variant: 'default' as BadgeVariant,
                  };
                  return (
                    <div
                      key={engagement.id}
                      onClick={() => navigate(`/faculty/applications/${engagement.id}`)}
                      className="cursor-pointer hover:shadow-md transition-shadow rounded-xl"
                    >
                      <Card>
                        <Card.Body className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2">
                              {engagement.facultyOpportunityTitle}
                            </h3>
                            <Badge variant={cfg.variant} size="sm">
                              {cfg.label}
                            </Badge>
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {engagement.institutionName}
                          </p>

                          {engagement.startDate && engagement.endDate && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {format(new Date(engagement.startDate), 'MMM d, yyyy')} &ndash;{' '}
                              {format(new Date(engagement.endDate), 'MMM d, yyyy')}
                            </p>
                          )}

                          {engagement.outcome && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                              {engagement.outcome}
                            </p>
                          )}
                        </Card.Body>
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}

            {!isEngagementsLoading && !isEngagementsError && engagements.length === 0 && (
              <EmptyState
                icon={<FiActivity />}
                title="No engagements yet"
                description="Your faculty-industry collaborations will appear here once created."
              />
            )}

            {engagementsData && engagementsData.totalPages > 1 && (
              <div className="flex justify-center">
                <Pagination
                  page={engagementsData.page}
                  totalPages={engagementsData.totalPages}
                  onChange={setEngagementPage}
                />
              </div>
            )}
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>
    </div>
  );
}
