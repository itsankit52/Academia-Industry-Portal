import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBriefcase, FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Filters from '@/components/ui/Filters';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useCompanyJobs, usePatchJob, useDeleteJob } from '@/hooks/queries/useCompanyJobs';
import { JOB_STATUSES } from '@aip/config';
import type { JobStatus } from '@aip/config';
import type { Job } from '@aip/types';
import { format } from 'date-fns';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<JobStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Draft', variant: 'default' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  CLOSED: { label: 'Closed', variant: 'danger' },
  ARCHIVED: { label: 'Archived', variant: 'default' },
};

const statusOptions = [
  { value: '', label: 'All statuses' },
  ...JOB_STATUSES.map((s) => ({ value: s, label: statusConfig[s].label })),
];

export default function CompanyJobManage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const { data, isLoading, isError, refetch } = useCompanyJobs(statusFilter ? { status: statusFilter } : undefined);
  const jobs = data?.items ?? [];
  const patchJob = usePatchJob();
  const deleteJob = useDeleteJob();

  if (isError) return <ErrorState onRetry={refetch} />;

  function toggleStatus(job: Job) {
    const next: JobStatus = job.status === 'PUBLISHED' ? 'CLOSED' : 'PUBLISHED';
    patchJob.mutate({ id: job.id, data: { status: next } });
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Manage Jobs"
        subtitle="Publish, close, or delete your job listings."
        actions={
          <Link to="/company/jobs/new">
            <Button size="sm" iconLeft={<FiPlus className="w-4 h-4" />}>Post Job</Button>
          </Link>
        }
      />

      <Filters>
        <Select label="Status" options={statusOptions} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Title</Table.Th>
            <Table.Th>Location</Table.Th>
            <Table.Th>Mode</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Openings</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Deadline</Table.Th>
            <Table.Th>Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={5} cols={8} />
          ) : jobs.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <EmptyState icon={<FiBriefcase />} title="No jobs found" />
              </td>
            </tr>
          ) : (
            jobs.map((job) => {
              const cfg = statusConfig[job.status];
              return (
                <tr key={job.id}>
                  <Table.Td className="font-medium">{job.title}</Table.Td>
                  <Table.Td>{job.location}</Table.Td>
                  <Table.Td>{job.workMode}</Table.Td>
                  <Table.Td>{job.employmentType.replace('_', ' ')}</Table.Td>
                  <Table.Td>{job.openings}</Table.Td>
                  <Table.Td><Badge variant={cfg.variant} size="sm">{cfg.label}</Badge></Table.Td>
                  <Table.Td>{job.applicationDeadline ? format(new Date(job.applicationDeadline), 'MMM d, yyyy') : '—'}</Table.Td>
                  <Table.Td>
                    <div className="flex items-center gap-2">
                      <Link to={`/company/jobs/${job.id}/edit`}>
                         <button className="p-1.5 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors" aria-label="Edit">
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                      </Link>
                      <button
                        onClick={() => toggleStatus(job)}
                        className="text-xs font-medium px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        disabled={patchJob.isPending}
                      >
                        {job.status === 'PUBLISHED' ? 'Close' : 'Publish'}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(job)}
                        className="p-1.5 rounded text-slate-400 dark:text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        aria-label="Delete"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Table.Td>
                </tr>
              );
            })
          )}
        </Table.Body>
      </Table>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Job"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteJob.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteJob.isPending}
      />
    </div>
  );
}
