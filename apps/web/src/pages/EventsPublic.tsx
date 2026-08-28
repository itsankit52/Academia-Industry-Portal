import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { FiCalendar, FiMapPin, FiUsers, FiSearch } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useEvents, useRegisterForEvent, type EventFilters } from '@/hooks/queries/useEvents';
import { useAuth } from '@/hooks/useAuth';
import { COLLAB_EVENT_TYPES } from '@aip/config';

const eventTypeOptions = [
  { value: '', label: 'All types' },
  ...COLLAB_EVENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') })),
];

export default function EventsPublic() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState<EventFilters['eventType'] | ''>('');

  const filters: EventFilters = {
    pageSize: 24,
    ...(search ? { search } : {}),
    ...(eventType ? { eventType: eventType as EventFilters['eventType'] } : {}),
  };
  const q = useEvents(filters);
  const registerMut = useRegisterForEvent();

  const handleRegister = (eventId: string) => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/events/${eventId}`);
      return;
    }
    registerMut.mutate(eventId);
  };

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Events"
        subtitle="Discover workshops, guest lectures, challenges, live projects, training programs, and research collaborations."
      />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_240px] gap-3">
        <Input
          placeholder="Search events…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          iconLeft={<FiSearch className="w-4 h-4" />}
        />
        <Select
          options={eventTypeOptions}
          value={eventType}
          onChange={(e) => setEventType(e.target.value as typeof eventType)}
        />
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : q.data && q.data.items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {q.data.items.map((ev) => {
            const host = typeof ev.host === 'string' ? ev.host : ev.host.name;
            const full = typeof ev.capacity === 'number' && ev.registeredCount >= ev.capacity;
            return (
              <Card key={ev.id}>
                <Card.Body className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {ev.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">by {host}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="info" size="sm">
                      {ev.eventType.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="default" size="sm">
                      {ev.mode}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">
                    {ev.description}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <FiCalendar className="w-3.5 h-3.5" />{' '}
                      {format(new Date(ev.startAt), 'MMM d, yyyy')}
                    </span>
                    {ev.location && (
                      <span className="inline-flex items-center gap-1">
                        <FiMapPin className="w-3.5 h-3.5" /> {ev.location}
                      </span>
                    )}
                    {typeof ev.capacity === 'number' && (
                      <span className="inline-flex items-center gap-1">
                        <FiUsers className="w-3.5 h-3.5" /> {ev.registeredCount}/{ev.capacity}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      disabled={full}
                      loading={registerMut.isPending && registerMut.variables === ev.id}
                      onClick={() => handleRegister(ev.id)}
                    >
                      {full ? 'Full' : isAuthenticated ? 'Register' : 'Sign in to Register'}
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<FiCalendar />}
          title="No events found"
          description="Try clearing filters or checking back later."
        />
      )}
    </div>
  );
}
