import { useState } from 'react';
import { FiList } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Filters from '@/components/ui/Filters';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useAuditLogs } from '@/hooks/queries/useAuditLogs';
import { AUDIT_ACTIONS } from '@aip/config';

const actionOptions = [
  { value: '', label: 'All Actions' },
  ...AUDIT_ACTIONS.map((a) => ({ value: a, label: a.replace(/_/g, ' ') })),
];

export default function AdminAuditLogs() {
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const filters = {
    ...(actor ? { actor } : {}),
    ...(action ? { action } : {}),
    ...(entity ? { entity } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    page,
  };

  const { data, isLoading, isError, refetch } = useAuditLogs(filters);
  const logs = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  if (isError) return <ErrorState onRetry={refetch} />;

  function resetPage() {
    setPage(1);
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Audit Logs"
        subtitle={data ? `${data.total} event${data.total !== 1 ? 's' : ''} recorded.` : 'Full history of all platform actions.'}
      />

      <Filters>
        <Input
          label="Actor Email"
          placeholder="user@example.com"
          value={actor}
          onChange={(e) => { setActor(e.target.value); resetPage(); }}
        />
        <Select
          label="Action"
          options={actionOptions}
          value={action}
          onChange={(e) => { setAction(e.target.value); resetPage(); }}
        />
        <Input
          label="Entity"
          placeholder="e.g. JOB"
          value={entity}
          onChange={(e) => { setEntity(e.target.value); resetPage(); }}
        />
        <Input
          label="From"
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); resetPage(); }}
        />
        <Input
          label="To"
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); resetPage(); }}
        />
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Time</Table.Th>
            <Table.Th>Actor</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Action</Table.Th>
            <Table.Th>Entity</Table.Th>
            <Table.Th>Entity ID</Table.Th>
            <Table.Th>IP</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={10} cols={7} />
          ) : logs.length === 0 ? (
            <tr><td colSpan={7}><EmptyState icon={<FiList />} title="No audit logs found" /></td></tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id}>
                <Table.Td className="text-xs text-slate-500 whitespace-nowrap">
                  {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm')}
                </Table.Td>
                <Table.Td className="text-sm">{log.actorEmail ?? '—'}</Table.Td>
                <Table.Td className="text-xs text-slate-500">{log.role ?? '—'}</Table.Td>
                <Table.Td>
                  <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                    {log.action}
                  </span>
                </Table.Td>
                <Table.Td className="text-sm">{log.entity ?? '—'}</Table.Td>
                <Table.Td className="text-xs text-slate-400 font-mono max-w-[100px] truncate">
                  {log.entityId ?? '—'}
                </Table.Td>
                <Table.Td className="text-xs text-slate-400">{log.ip ?? '—'}</Table.Td>
              </tr>
            ))
          )}
        </Table.Body>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
