import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import MatchBadge from '@/components/ui/MatchBadge';
import Select from '@/components/ui/Select';
import Filters from '@/components/ui/Filters';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import {
  useCompanyApplicants,
  useUpdateApplicationStatus,
} from '@/hooks/queries/useCompanyApplicants';
import { APPLICATION_STATUSES } from '@aip/config';
import type { ApplicationStatus } from '@aip/config';
import { getStudentName, getStudentEmail, getOpportunityTitle } from '@aip/types';
import { format } from 'date-fns';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<ApplicationStatus, { label: string; variant: BadgeVariant }> = {
  APPLIED: { label: 'Applied', variant: 'info' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'warning' },
  SHORTLISTED: { label: 'Shortlisted', variant: 'success' },
  INTERVIEW_SCHEDULED: { label: 'Interview', variant: 'success' },
  SELECTED: { label: 'Selected', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'default' },
};

const statusOptions = [
  { value: '', label: 'All statuses' },
  ...APPLICATION_STATUSES.map((s) => ({ value: s, label: statusConfig[s].label })),
];

export default function CompanyApplicants() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [minScore, setMinScore] = useState('');

  const filters = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(minScore ? { minMatchScore: Number(minScore) } : {}),
  };

  const { data, isLoading, isError, refetch } = useCompanyApplicants(filters);
  const applications = data?.items ?? [];
  const updateStatus = useUpdateApplicationStatus();

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Applicants" subtitle="All caught up." />

      <Filters>
        <Select
          label="Status"
          options={statusOptions}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
        <Input
          label="Min Match Score"
          type="number"
          min={0}
          max={100}
          placeholder="e.g. 60"
          value={minScore}
          onChange={(e) => setMinScore(e.target.value)}
        />
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Candidate</Table.Th>
            <Table.Th>Opportunity</Table.Th>
            <Table.Th>Match</Table.Th>
            <Table.Th>Applied</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={6} cols={6} />
          ) : applications.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <EmptyState icon={<FiUsers />} title="No applicants found" />
              </td>
            </tr>
          ) : (
            applications.map((app) => {
              const cfg = statusConfig[app.status];
              return (
                <tr
                  key={app.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/company/applicants/${app.id}`)}
                >
                  <Table.Td>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {getStudentName(app)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {getStudentEmail(app)}
                      </p>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {getOpportunityTitle(app)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {app.opportunityType}
                    </p>
                  </Table.Td>
                  <Table.Td>
                    {app.matchScore !== null && app.matchScore !== undefined ? (
                      <MatchBadge score={app.matchScore} />
                    ) : (
                      '—'
                    )}
                  </Table.Td>
                  <Table.Td>{format(new Date(app.createdAt), 'MMM d, yyyy')}</Table.Td>
                  <Table.Td>
                    <Badge variant={cfg.variant} size="sm">
                      {cfg.label}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {app.status !== 'SHORTLISTED' && (
                        <button
                          onClick={() => updateStatus.mutate({ id: app.id, status: 'SHORTLISTED' })}
                          className="text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors"
                        >
                          Shortlist
                        </button>
                      )}
                      {app.status !== 'REJECTED' && (
                        <button
                          onClick={() => updateStatus.mutate({ id: app.id, status: 'REJECTED' })}
                          className="text-xs px-2 py-1 rounded border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </Table.Td>
                </tr>
              );
            })
          )}
        </Table.Body>
      </Table>
    </div>
  );
}
