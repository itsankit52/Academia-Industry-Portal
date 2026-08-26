import { useState } from 'react';
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
import {
  useEvents,
  useRegisterForEvent,
  useMyRegistrations,
  type EventFilters,
} from '@/hooks/queries/useEvents';
import { COLLAB_EVENT_TYPES } from '@aip/config';

const eventTypeOptions = [
  { value: '', label: 'All types' },
  ...COLLAB_EVENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') })),
];

const modeOptions = [
  { value: '', label: 'All modes' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'ONSITE', label: 'Onsite' },
  { value: 'HYBRID', label: 'Hybrid' },
];

export default function StudentEvents() {
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState<EventFilters['eventType'] | ''>('');
  const [mode, setMode] = useState<EventFilters['mode'] | ''>('');

  const filters: EventFilters = {
    ...(search ? { search } : {}),
    ...(eventType ? { eventType: eventType as EventFilters['eventType'] } : {}),
    ...(mode ? { mode: mode as EventFilters['mode'] } : {}),
  };
  const eventsQ = useEvents(filters);
  const registrationsQ = useMyRegistrations({ pageSize: 200 });
  const registerMut = useRegisterForEvent();

  const registeredIds = new Set(
    (registrationsQ.data?.items ?? []).map((r) => (r.event ? r.event.id : '')),
  );

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Events" subtitle="Workshops, guest lectures, challenges and live projects." />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px_200px] gap-3">
        <Input placeholder="Search events…" value={search} onChange={(e) => setSearch(e.target.value)} iconLeft={<FiSearch className="w-4 h-4" />} />
        <Select
          options={eventTypeOptions}
          value={eventType}
          onChange={(e) => setEventType(e.target.value as typeof eventType)}
        />
        <Select
          options={modeOptions}
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        />
      </div>

      {eventsQ.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : eventsQ.isError ? (
        <ErrorState onRetry={() => void eventsQ.refetch()} />
      ) : eventsQ.data && eventsQ.data.items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {eventsQ.data.items.map((ev) => {
            const registered = registeredIds.has(ev.id);
            const full = typeof ev.capacity === 'number' && ev.registeredCount >= ev.capacity;
            const hostName = typeof ev.host === 'string' ? ev.host : ev.host.name;
            return (
              <Card key={ev.id}>
                <Card.Body className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{ev.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">by {hostName}</p>
                    </div>
                    <Badge variant="info" size="sm">{ev.eventType.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">{ev.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1"><FiCalendar className="w-3.5 h-3.5" /> {format(new Date(ev.startAt), 'MMM d, yyyy')}</span>
                    <span className="inline-flex items-center gap-1"><FiMapPin className="w-3.5 h-3.5" /> {ev.mode}{ev.location ? ` · ${ev.location}` : ''}</span>
                    {typeof ev.capacity === 'number' && (
                      <span className="inline-flex items-center gap-1"><FiUsers className="w-3.5 h-3.5" /> {ev.registeredCount}/{ev.capacity}</span>
                    )}
                  </div>
                  <div className="flex justify-end pt-2">
                    {registered ? (
                      <Badge variant="success">Registered</Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={full}
                        loading={registerMut.isPending && registerMut.variables === ev.id}
                        onClick={() => registerMut.mutate(ev.id)}
                      >
                        {full ? 'Full' : 'Register'}
                      </Button>
                    )}
                  </div>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<FiCalendar />} title="No events found" description="Try clearing filters or checking back later." />
      )}
    </div>
  );
}
