import { useState } from 'react';
import { format } from 'date-fns';
import { FiSearch, FiSend, FiXCircle } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useEvents, usePublishEvent, useCancelEvent, type EventFilters } from '@/hooks/queries/useEvents';

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  CANCELLED: 'danger',
  COMPLETED: 'info',
};

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'COMPLETED', label: 'Completed' },
];

export default function AdminEvents() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EventFilters['status'] | ''>('');
  const filters: EventFilters = {
    pageSize: 100,
    ...(search ? { search } : {}),
    ...(status ? { status: status as EventFilters['status'] } : {}),
  };
  const q = useEvents(filters);
  const publishMut = usePublishEvent();
  const cancelMut = useCancelEvent();

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Moderate Events" subtitle="Force-publish or cancel any event across the platform." />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_240px] gap-3">
        <Input placeholder="Search events…" value={search} onChange={(e) => setSearch(e.target.value)} iconLeft={<FiSearch className="w-4 h-4" />} />
        <Select options={statusOptions} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} />
      </div>

      {q.isLoading ? (
        <SkeletonCard />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : q.data && q.data.items.length > 0 ? (
        <Card>
          <Card.Body className="divide-y divide-slate-100 dark:divide-slate-800 -my-2">
            {q.data.items.map((ev) => {
              const host = typeof ev.host === 'string' ? ev.host : ev.host.name;
              return (
                <div key={ev.id} className="py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{ev.title}</p>
                      <Badge variant={statusVariant[ev.status] ?? 'default'} size="sm">{ev.status}</Badge>
                      <Badge variant="info" size="sm">{ev.eventType.replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {host} · {format(new Date(ev.startAt), 'MMM d, yyyy HH:mm')} · {ev.mode}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ev.status !== 'PUBLISHED' && ev.status !== 'CANCELLED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        iconLeft={<FiSend className="w-4 h-4" />}
                        loading={publishMut.isPending && publishMut.variables === ev.id}
                        onClick={() => publishMut.mutate(ev.id)}
                      >
                        Publish
                      </Button>
                    )}
                    {ev.status !== 'CANCELLED' && ev.status !== 'COMPLETED' && (
                      <Button
                        size="sm"
                        variant="danger"
                        iconLeft={<FiXCircle className="w-4 h-4" />}
                        loading={cancelMut.isPending && cancelMut.variables === ev.id}
                        onClick={() => cancelMut.mutate(ev.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </Card.Body>
        </Card>
      ) : (
        <EmptyState title="No events" description="No events match the current filters." />
      )}
    </div>
  );
}
