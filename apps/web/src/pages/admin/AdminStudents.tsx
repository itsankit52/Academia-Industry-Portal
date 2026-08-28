import { useState } from 'react';
import { FiUsers } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Filters from '@/components/ui/Filters';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useAdminStudents, useToggleUserActive } from '@/hooks/queries/useAdminStudents';

export default function AdminStudents() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [confirmTarget, setConfirmTarget] = useState<{
    id: string;
    email: string;
    isActive: boolean;
  } | null>(null);

  const filters = {
    ...(statusFilter === 'active' ? { isActive: true } : {}),
    ...(statusFilter === 'inactive' ? { isActive: false } : {}),
  };

  const { data, isLoading, isError, refetch } = useAdminStudents(filters);
  const students = data?.items ?? [];
  const toggleActive = useToggleUserActive();

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Students"
        subtitle={`${data?.total ?? students.length} registered student${(data?.total ?? students.length) !== 1 ? 's' : ''}.`}
      />

      <Filters>
        <div className="self-end">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="block w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Email</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Joined</Table.Th>
            <Table.Th>Last Login</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={8} cols={6} />
          ) : students.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <EmptyState icon={<FiUsers />} title="No students found" />
              </td>
            </tr>
          ) : (
            students.map((s) => (
              <tr key={s.id}>
                <Table.Td className="font-medium">{s.email}</Table.Td>
                <Table.Td>
                  <Badge variant="info" size="sm">
                    {s.role}
                  </Badge>
                </Table.Td>
                <Table.Td>{new Date(s.createdAt).toLocaleDateString()}</Table.Td>
                <Table.Td>
                  {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString() : '—'}
                </Table.Td>
                <Table.Td>
                  <Badge variant={s.isActive ? 'success' : 'danger'} size="sm">
                    {s.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <button
                    onClick={() =>
                      setConfirmTarget({ id: s.id, email: s.email, isActive: s.isActive })
                    }
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
        description={`Are you sure you want to ${confirmTarget?.isActive ? 'deactivate' : 'activate'} ${confirmTarget?.email}?`}
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
