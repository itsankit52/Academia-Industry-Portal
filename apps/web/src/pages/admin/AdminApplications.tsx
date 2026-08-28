import { useState } from 'react';
import { FiFileText } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Filters from '@/components/ui/Filters';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useAdminApplications } from '@/hooks/queries/useAdminApplications';
import { APPLICATION_STATUSES, OPPORTUNITY_TYPES } from '@aip/config';
import { getStudentName, getStudentEmail, getOpportunityTitle, getCompanyName } from '@aip/types';

const statusOptions = [
  { value: '', label: 'All Statuses' },
  ...APPLICATION_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
];

const typeOptions = [
  { value: '', label: 'All Types' },
  ...OPPORTUNITY_TYPES.map((t) => ({ value: t, label: t })),
];

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  APPLIED: 'default',
  UNDER_REVIEW: 'warning',
  SHORTLISTED: 'success',
  INTERVIEW_SCHEDULED: 'success',
  SELECTED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'default',
};

export default function AdminApplications() {
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [company, setCompany] = useState('');
  const [q, setQ] = useState('');

  const filters = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(company ? { company } : {}),
    ...(q ? { q } : {}),
  };

  const { data, isLoading, isError, refetch } = useAdminApplications(filters);
  const applications = data?.items ?? [];

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Applications"
        subtitle={`${applications.length} application${applications.length !== 1 ? 's' : ''} across the platform.`}
      />

      <Filters>
        <Input
          label="Search"
          placeholder="Student or opportunity..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Input
          label="Company"
          placeholder="Company name"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <Select
          label="Type"
          options={typeOptions}
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
        <Select
          label="Status"
          options={statusOptions}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Student</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Opportunity</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Company</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Match Score</Table.Th>
            <Table.Th>Applied</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={8} cols={8} />
          ) : applications.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <EmptyState icon={<FiFileText />} title="No applications found" />
              </td>
            </tr>
          ) : (
            applications.map((app) => (
              <tr key={app.id}>
                <Table.Td className="font-medium">{getStudentName(app)}</Table.Td>
                <Table.Td className="text-slate-500 dark:text-slate-400 text-sm">
                  {getStudentEmail(app)}
                </Table.Td>
                <Table.Td className="max-w-[180px] truncate">{getOpportunityTitle(app)}</Table.Td>
                <Table.Td>
                  <Badge variant="default" size="sm">
                    {app.opportunityType}
                  </Badge>
                </Table.Td>
                <Table.Td>{getCompanyName(app)}</Table.Td>
                <Table.Td>
                  <Badge variant={statusVariant[app.status] ?? 'default'} size="sm">
                    {app.status.replace(/_/g, ' ')}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {app.matchScore !== null && app.matchScore !== undefined
                    ? `${app.matchScore}%`
                    : '—'}
                </Table.Td>
                <Table.Td className="text-slate-500 dark:text-slate-400 text-sm">
                  {format(new Date(app.createdAt), 'dd MMM yyyy')}
                </Table.Td>
              </tr>
            ))
          )}
        </Table.Body>
      </Table>
    </div>
  );
}
