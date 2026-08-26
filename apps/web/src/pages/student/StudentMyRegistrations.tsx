import { format } from 'date-fns';
import { FiCalendar, FiCheckCircle } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useMyRegistrations, useUnregisterFromEvent } from '@/hooks/queries/useEvents';

export default function StudentMyRegistrations() {
  const q = useMyRegistrations({ pageSize: 100 });
  const unreg = useUnregisterFromEvent();

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="My Event Registrations" subtitle="Events you have signed up for." />
      {q.isLoading ? (
        <SkeletonCard />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : q.data && q.data.items.length > 0 ? (
        <div className="space-y-3">
          {q.data.items.map((r) => (
            <Card key={r.id}>
              <Card.Body className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {r.event ? r.event.title : 'Event no longer available'}
                    </h3>
                    {r.attendedAt && (
                      <Badge variant="success" size="sm">
                        <FiCheckCircle className="w-3 h-3 mr-1" />
                        Attended
                      </Badge>
                    )}
                  </div>
                  {r.event && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 inline-flex items-center gap-1">
                      <FiCalendar className="w-3.5 h-3.5" />
                      {format(new Date(r.event.startAt), 'MMM d, yyyy')} · {r.event.mode} · {r.event.host.name}
                    </p>
                  )}
                </div>
                {r.event && !r.attendedAt && (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={unreg.isPending && unreg.variables === r.event.id}
                    onClick={() => r.event && unreg.mutate(r.event.id)}
                  >
                    Unregister
                  </Button>
                )}
              </Card.Body>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<FiCalendar />} title="No registrations" description="Browse events and register to see them here." />
      )}
    </div>
  );
}
