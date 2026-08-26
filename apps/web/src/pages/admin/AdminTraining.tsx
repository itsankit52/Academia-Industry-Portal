import { useState } from 'react';
import { FiBookOpen, FiPlus, FiExternalLink } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Filters from '@/components/ui/Filters';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import TrainingFormModal from '@/components/features/TrainingFormModal';
import { useAdminTrainings, useDeleteTraining } from '@/hooks/queries/useAdminTrainings';
import type { TrainingProgram } from '@aip/types';

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export default function AdminTraining() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TrainingProgram | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const { data, isLoading, isError, refetch } = useAdminTrainings({
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
  });
  const trainings = data?.items ?? [];
  const deleteTraining = useDeleteTraining();

  if (isError) return <ErrorState onRetry={refetch} />;

  function openCreate() {
    setEditTarget(undefined);
    setModalOpen(true);
  }

  function openEdit(t: TrainingProgram) {
    setEditTarget(t);
    setModalOpen(true);
  }

  return (
    <div className="container-page py-8 space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Training Programmes"
          subtitle={`${trainings.length} programme${trainings.length !== 1 ? 's' : ''} available to students.`}
        />
        <Button size="sm" onClick={openCreate}>
          <FiPlus className="inline mr-1" />
          Add Training
        </Button>
      </div>

      <Filters>
        <Input label="Search" placeholder="Title or provider..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Select label="Status" options={statusOptions} value={status} onChange={(e) => setStatus(e.target.value)} />
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Title</Table.Th>
            <Table.Th>Provider</Table.Th>
            <Table.Th>Duration</Table.Th>
            <Table.Th>Start Date</Table.Th>
            <Table.Th>Reg. Deadline</Table.Th>
            <Table.Th>Skills</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={6} cols={8} />
          ) : trainings.length === 0 ? (
            <tr><td colSpan={8}><EmptyState icon={<FiBookOpen />} title="No training programmes found" /></td></tr>
          ) : (
            trainings.map((t) => (
              <tr key={t.id}>
                <Table.Td>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium max-w-[180px] truncate">{t.title}</span>
                    <a
                      href={t.registrationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0"
                    >
                      <FiExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </Table.Td>
                <Table.Td>{t.provider}</Table.Td>
                <Table.Td>{t.durationWeeks}w</Table.Td>
                <Table.Td className="text-sm text-slate-500">
                  {t.startDate ? format(new Date(t.startDate), 'dd MMM yyyy') : '—'}
                </Table.Td>
                <Table.Td className="text-sm text-slate-500">
                  {t.registrationDeadline ? format(new Date(t.registrationDeadline), 'dd MMM yyyy') : '—'}
                </Table.Td>
                <Table.Td>{t.skills.length}</Table.Td>
                <Table.Td>
                  <Badge variant={t.status === 'ACTIVE' ? 'success' : 'default'} size="sm">
                    {t.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(t)}
                        className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: t.id, title: t.title })}
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

      <TrainingFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        training={editTarget}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Training"
        description={`Delete "${deleteTarget?.title}"? Students currently enrolled may lose access.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) {
            deleteTraining.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
          }
        }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteTraining.isPending}
      />
    </div>
  );
}
