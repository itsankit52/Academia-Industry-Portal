import { useState } from 'react';
import { FiPackage } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Filters from '@/components/ui/Filters';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useAdminInternships, useAdminForceCloseInternship, useAdminDeleteInternship } from '@/hooks/queries/useAdminInternships';
import { INTERNSHIP_STATUSES } from '@aip/config';

const statusOptions = [
  { value: '', label: 'All Statuses' },
  ...INTERNSHIP_STATUSES.map((s) => ({ value: s, label: s })),
];

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  PUBLISHED: 'success',
  DRAFT: 'warning',
  CLOSED: 'danger',
  ARCHIVED: 'default',
};

export default function AdminInternships() {
  const [status, setStatus] = useState('');
  const [company, setCompany] = useState('');
  const [q, setQ] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const filters = {
    ...(status ? { status } : {}),
    ...(company ? { company } : {}),
    ...(q ? { q } : {}),
  };

  const { data, isLoading, isError, refetch } = useAdminInternships(filters);
  const internships = data?.items ?? [];
  const forceClose = useAdminForceCloseInternship();
  const deleteInternship = useAdminDeleteInternship();

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Internships"
        subtitle={`${internships.length} internship${internships.length !== 1 ? 's' : ''} across the platform.`}
      />

      <Filters>
        <Input label="Search" placeholder="Internship title..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Input label="Company" placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)} />
        <Select label="Status" options={statusOptions} value={status} onChange={(e) => setStatus(e.target.value)} />
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Title</Table.Th>
            <Table.Th>Company</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Work Mode</Table.Th>
            <Table.Th>Duration</Table.Th>
            <Table.Th>Stipend</Table.Th>
            <Table.Th>Deadline</Table.Th>
            <Table.Th>Openings</Table.Th>
            <Table.Th>Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={8} cols={9} />
          ) : internships.length === 0 ? (
            <tr><td colSpan={9}><EmptyState icon={<FiPackage />} title="No internships found" /></td></tr>
          ) : (
            internships.map((i) => (
              <tr key={i.id}>
                <Table.Td className="font-medium max-w-[200px] truncate">{i.title}</Table.Td>
                <Table.Td>{i.company.name}</Table.Td>
                <Table.Td>
                  <Badge variant={statusVariant[i.status] ?? 'default'} size="sm">{i.status}</Badge>
                </Table.Td>
                <Table.Td>{i.workMode}</Table.Td>
                <Table.Td>{i.durationMonths}mo</Table.Td>
                <Table.Td>
                  {i.stipend ? `${i.currency ?? '₹'}${i.stipend.toLocaleString()}/mo` : '—'}
                </Table.Td>
                <Table.Td>
                  {i.applicationDeadline
                    ? format(new Date(i.applicationDeadline), 'dd MMM yyyy')
                    : '—'}
                </Table.Td>
                <Table.Td>{i.openings}</Table.Td>
                <Table.Td>
                  <div className="flex gap-2">
                    {i.status !== 'CLOSED' && (
                      <button
                        onClick={() => forceClose.mutate(i.id)}
                        disabled={forceClose.isPending}
                        className="text-xs px-2 py-1 rounded border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-50"
                      >
                        Close
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTarget({ id: i.id, title: i.title })}
                       className="text-xs px-2 py-1 rounded border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                     >
                       Delete
                    </button>
                  </div>
                </Table.Td>
              </tr>
            ))
          )}
        </Table.Body>
      </Table>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Internship"
        description={`Permanently delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) {
            deleteInternship.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
          }
        }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteInternship.isPending}
      />
    </div>
  );
}
