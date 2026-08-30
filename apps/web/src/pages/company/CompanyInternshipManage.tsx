import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBook, FiEdit2, FiTrash2, FiPlus, FiUsers } from 'react-icons/fi';
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
import { useCompanyInternships, usePatchInternship, useDeleteInternship } from '@/hooks/queries/useCompanyInternships';
import { INTERNSHIP_STATUSES } from '@aip/config';
import type { InternshipStatus } from '@aip/config';
import type { Internship } from '@aip/types';
import { format } from 'date-fns';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<InternshipStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Draft', variant: 'default' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  CLOSED: { label: 'Closed', variant: 'danger' },
  ARCHIVED: { label: 'Archived', variant: 'default' },
};

const statusOptions = [
  { value: '', label: 'All statuses' },
  ...INTERNSHIP_STATUSES.map((s) => ({ value: s, label: statusConfig[s].label })),
];

export default function CompanyInternshipManage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Internship | null>(null);
  const { data, isLoading, isError, refetch } = useCompanyInternships(statusFilter ? { status: statusFilter } : undefined);
  const internships = data?.items ?? [];
  const patchInternship = usePatchInternship();
  const deleteInternship = useDeleteInternship();

  if (isError) return <ErrorState onRetry={refetch} />;

  function toggleStatus(internship: Internship) {
    const next: InternshipStatus = internship.status === 'PUBLISHED' ? 'CLOSED' : 'PUBLISHED';
    patchInternship.mutate({ id: internship.id, data: { status: next } });
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Manage Internships"
        subtitle="Publish, close, or delete your internship listings. View and manage applicants."
        actions={
          <Link to="/company/internships/new">
            <Button size="sm" iconLeft={<FiPlus className="w-4 h-4" />}>Post Internship</Button>
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
            <Table.Th>Duration</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Applicants</Table.Th>
            <Table.Th>Deadline</Table.Th>
            <Table.Th>Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={5} cols={8} />
          ) : internships.length === 0 ? (
            <tr><td colSpan={8}><EmptyState icon={<FiBook />} title="No internships found" /></td></tr>
          ) : (
            internships.map((internship) => {
              const cfg = statusConfig[internship.status];
              return (
                <tr key={internship.id}>
                  <Table.Td className="font-medium">{internship.title}</Table.Td>
                  <Table.Td>{internship.location}</Table.Td>
                  <Table.Td>{internship.workMode}</Table.Td>
                  <Table.Td>{internship.durationMonths}mo</Table.Td>
                  <Table.Td><Badge variant={cfg.variant} size="sm">{cfg.label}</Badge></Table.Td>
                  <Table.Td>
                    <Link
                      to={`/company/applicants?opportunityId=${internship.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 no-underline"
                    >
                      <FiUsers className="w-3.5 h-3.5" />
                      View
                    </Link>
                  </Table.Td>
                  <Table.Td>{internship.applicationDeadline ? format(new Date(internship.applicationDeadline), 'MMM d, yyyy') : '—'}</Table.Td>
                  <Table.Td>
                    <div className="flex items-center gap-2">
                      <Link to={`/company/internships/${internship.id}/edit`}>
                         <button className="p-1.5 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors" aria-label="Edit">
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                      </Link>
                      <button
                        onClick={() => toggleStatus(internship)}
                        className="text-xs font-medium px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        disabled={patchInternship.isPending}
                      >
                        {internship.status === 'PUBLISHED' ? 'Close' : 'Publish'}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(internship)}
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
        title="Delete Internship"
        description={`Are you sure you want to delete "${deleteTarget?.title}"?`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteInternship.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteInternship.isPending}
      />
    </div>
  );
}
