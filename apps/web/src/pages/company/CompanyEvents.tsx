import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { FiPlus, FiCalendar } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useEvents } from '@/hooks/queries/useEvents';

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  CANCELLED: 'danger',
  COMPLETED: 'info',
};

interface CompanyEventsProps {
  basePath?: string;
  title?: string;
}

export default function CompanyEvents({
  basePath = '/company/events',
  title = 'My Events',
}: CompanyEventsProps = {}) {
  const navigate = useNavigate();
  const q = useEvents({ mine: true, pageSize: 100 });

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title={title}
        subtitle="Workshops, guest lectures, challenges, and live projects hosted by you."
        actions={
          <Button iconLeft={<FiPlus className="w-4 h-4" />} onClick={() => navigate(`${basePath}/new`)}>
            New Event
          </Button>
        }
      />

      {q.isLoading ? (
        <SkeletonCard />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : q.data && q.data.items.length > 0 ? (
        <Card>
          <Card.Body className="divide-y divide-slate-100 dark:divide-slate-800 -my-2">
            {q.data.items.map((ev) => (
              <Link
                key={ev.id}
                to={`${basePath}/${ev.id}`}
                className="py-3 flex items-center justify-between no-underline hover:bg-slate-50 dark:hover:bg-slate-800 -mx-6 px-6"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{ev.title}</p>
                    <Badge variant={statusVariant[ev.status] ?? 'default'} size="sm">{ev.status}</Badge>
                    <Badge variant="info" size="sm">{ev.eventType.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 inline-flex items-center gap-1">
                    <FiCalendar className="w-3.5 h-3.5" />
                    {format(new Date(ev.startAt), 'MMM d, yyyy HH:mm')} · {ev.mode}
                    {typeof ev.capacity === 'number' && ` · ${ev.registeredCount}/${ev.capacity} registered`}
                  </p>
                </div>
              </Link>
            ))}
          </Card.Body>
        </Card>
      ) : (
        <EmptyState
          icon={<FiCalendar />}
          title="No events yet"
          description="Create your first event to start engaging with students and faculty."
          action={{ label: 'Create Event', onClick: () => navigate(`${basePath}/new`) }}
        />
      )}
    </div>
  );
}
