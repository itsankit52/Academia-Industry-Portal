import { useState } from 'react';
import { FiTag, FiPlus } from 'react-icons/fi';
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
import SkillFormModal from '@/components/features/SkillFormModal';
import { useSkills, useDeleteSkill } from '@/hooks/queries/useSkills';
import { SKILL_CATEGORIES } from '@aip/config';
import type { Skill } from '@aip/types';

const categoryOptions = [
  { value: '', label: 'All Categories' },
  ...SKILL_CATEGORIES.map((c) => ({
    value: c,
    label: c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
  })),
];

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export default function AdminSkills() {
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Skill | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const filters = {
    ...(category ? { category } : {}),
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
  };

  const { data, isLoading, isError, refetch } = useSkills(filters);
  const skills = data?.items ?? [];
  const deleteSkill = useDeleteSkill();

  if (isError) return <ErrorState onRetry={refetch} />;

  function openCreate() {
    setEditTarget(undefined);
    setModalOpen(true);
  }

  function openEdit(skill: Skill) {
    setEditTarget(skill);
    setModalOpen(true);
  }

  return (
    <div className="container-page py-8 space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Skills"
          subtitle={`${skills.length} skill${skills.length !== 1 ? 's' : ''} in the taxonomy.`}
        />
        <Button size="sm" onClick={openCreate}>
          <FiPlus className="inline mr-1" />
          Add Skill
        </Button>
      </div>

      <Filters>
        <Input label="Search" placeholder="Skill name..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Select label="Category" options={categoryOptions} value={category} onChange={(e) => setCategory(e.target.value)} />
        <Select label="Status" options={statusOptions} value={status} onChange={(e) => setStatus(e.target.value)} />
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Created</Table.Th>
            <Table.Th>Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={8} cols={6} />
          ) : skills.length === 0 ? (
            <tr><td colSpan={6}><EmptyState icon={<FiTag />} title="No skills found" /></td></tr>
          ) : (
            skills.map((skill) => (
              <tr key={skill.id}>
                <Table.Td className="font-medium">{skill.name}</Table.Td>
                <Table.Td>
                  <span className="text-xs text-slate-500">{skill.category.replace(/_/g, ' ')}</span>
                </Table.Td>
                <Table.Td className="max-w-[240px] truncate text-slate-500 text-sm">
                  {skill.description ?? '—'}
                </Table.Td>
                <Table.Td>
                  <Badge variant={skill.status === 'ACTIVE' ? 'success' : 'default'} size="sm">
                    {skill.status}
                  </Badge>
                </Table.Td>
                <Table.Td className="text-slate-500 text-sm">
                  {format(new Date(skill.createdAt), 'dd MMM yyyy')}
                </Table.Td>
                <Table.Td>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(skill)}
                        className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: skill.id, name: skill.name })}
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

      <SkillFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        skill={editTarget}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Skill"
        description={`Delete "${deleteTarget?.name}" from the taxonomy? This may affect existing job listings.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) {
            deleteSkill.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
          }
        }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteSkill.isPending}
      />
    </div>
  );
}
