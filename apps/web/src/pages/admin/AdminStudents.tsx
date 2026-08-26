import { useState } from 'react';
import { FiUsers } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Filters from '@/components/ui/Filters';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useAdminStudents, useToggleUserActive } from '@/hooks/queries/useAdminStudents';

export default function AdminStudents() {
  const [college, setCollege] = useState('');
  const [branch, setBranch] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [minCgpa, setMinCgpa] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; isActive: boolean } | null>(null);

  const filters = {
    ...(college ? { college } : {}),
    ...(branch ? { branch } : {}),
    ...(gradYear ? { gradYear } : {}),
    ...(minCgpa ? { minCgpa } : {}),
  };

  const { data, isLoading, isError, refetch } = useAdminStudents(filters);
  const students = data?.items ?? [];
  const toggleActive = useToggleUserActive();

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Students" subtitle={`${students.length} registered student${students.length !== 1 ? 's' : ''}.`} />

      <Filters>
        <Input label="College" placeholder="Filter by college" value={college} onChange={(e) => setCollege(e.target.value)} />
        <Input label="Branch" placeholder="e.g. CSE" value={branch} onChange={(e) => setBranch(e.target.value)} />
        <Input label="Grad Year" type="number" placeholder="2025" value={gradYear} onChange={(e) => setGradYear(e.target.value)} />
        <Input label="Min CGPA" type="number" step="0.1" min={0} max={10} placeholder="7.0" value={minCgpa} onChange={(e) => setMinCgpa(e.target.value)} />
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>College</Table.Th>
            <Table.Th>Branch</Table.Th>
            <Table.Th>Grad Year</Table.Th>
            <Table.Th>CGPA</Table.Th>
            <Table.Th>Skills</Table.Th>
            <Table.Th>Applications</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={8} cols={9} />
          ) : students.length === 0 ? (
            <tr><td colSpan={9}><EmptyState icon={<FiUsers />} title="No students found" /></td></tr>
          ) : (
            students.map((s) => (
              <tr key={s.id}>
                <Table.Td className="font-medium">{s.fullName}</Table.Td>
                <Table.Td>{s.college ?? '—'}</Table.Td>
                <Table.Td>{s.branch ?? '—'}</Table.Td>
                <Table.Td>{s.graduationYear ?? '—'}</Table.Td>
                <Table.Td>{s.cgpa ?? '—'}</Table.Td>
                <Table.Td>{s.skillsCount}</Table.Td>
                <Table.Td>{s.applicationsCount}</Table.Td>
                <Table.Td>
                  <Badge variant={s.isActive ? 'success' : 'danger'} size="sm">
                    {s.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <button
                    onClick={() => setConfirmTarget({ id: s.userId, name: s.fullName, isActive: s.isActive })}
                    className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${s.isActive ? 'border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40' : 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/40'}`}
                  >
                    {s.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </Table.Td>
              </tr>
            ))
          )}
        </Table.Body>
      </Table>

      <ConfirmDialog
        open={!!confirmTarget}
        title={confirmTarget?.isActive ? 'Deactivate Student' : 'Activate Student'}
        description={`Are you sure you want to ${confirmTarget?.isActive ? 'deactivate' : 'activate'} ${confirmTarget?.name}?`}
        confirmLabel={confirmTarget?.isActive ? 'Deactivate' : 'Activate'}
        variant={confirmTarget?.isActive ? 'danger' : 'primary'}
        onConfirm={() => {
          if (confirmTarget) {
            toggleActive.mutate(
              { id: confirmTarget.id, isActive: !confirmTarget.isActive },
              { onSuccess: () => setConfirmTarget(null) },
            );
          }
        }}
        onCancel={() => setConfirmTarget(null)}
        loading={toggleActive.isPending}
      />
    </div>
  );
}
