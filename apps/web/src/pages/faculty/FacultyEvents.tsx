import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { FiCalendar, FiMapPin, FiUsers, FiPlus } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useEvents, useMyRegistrations, useUnregisterFromEvent } from '@/hooks/queries/useEvents';

const BASE_PATH = '/faculty/events';

export default function FacultyEvents() {
  const [tab, setTab] = useState<'hosting' | 'attending'>('hosting');
  const navigate = useNavigate();

  const myEventsQ = useEvents({ mine: true, pageSize: 100 });
  const regsQ = useMyRegistrations({ pageSize: 200 });
  const unregisterMut = useUnregisterFromEvent();

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Events"
        subtitle="Workshops, guest lectures, and other collaboration events."
        actions={
          <Link
            to={`${BASE_PATH}/new`}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 no-underline"
          >
            <FiPlus className="w-4 h-4" /> Create Event
          </Link>
        }
      />

      <Tabs value={tab} onChange={(v) => setTab(v as typeof tab)}>
        <Tabs.List>
          <Tabs.Tab value="hosting" label="My Events" />
          <Tabs.Tab value="attending" label="Attending" />
        </Tabs.List>

        <Tabs.Panels className="mt-6">
          {/* Events I host */}
          <Tabs.Panel value="hosting">
            {myEventsQ.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : myEventsQ.isError ? (
              <ErrorState onRetry={() => void myEventsQ.refetch()} />
            ) : myEventsQ.data && myEventsQ.data.items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myEventsQ.data.items.map((ev) => (
                  <Card key={ev.id}>
                    <Card.Body className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link
                            to={`${BASE_PATH}/${ev.id}`}
                            className="text-base font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 no-underline"
                          >
                            {ev.title}
                          </Link>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {ev.status}
                          </p>
                        </div>
                        <Badge variant="info" size="sm">
                          {ev.eventType.replace(/_/g, ' ')}
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
                        <span className="inline-flex items-center gap-1">
                          <FiMapPin className="w-3.5 h-3.5" /> {ev.mode}
                          {ev.location ? ` · ${ev.location}` : ''}
                        </span>
                        {typeof ev.capacity === 'number' && (
                          <span className="inline-flex items-center gap-1">
                            <FiUsers className="w-3.5 h-3.5" /> {ev.registeredCount}/{ev.capacity}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-end pt-2">
                        <Link
                          to={`${BASE_PATH}/${ev.id}`}
                          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium no-underline"
                        >
                          View →
                        </Link>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<FiCalendar />}
                title="No events yet"
                description="Create your first event to start hosting workshops and guest lectures."
                action={{
                  label: 'Create Event',
                  onClick: () => navigate(`${BASE_PATH}/new`),
                }}
              />
            )}
          </Tabs.Panel>

          {/* Events I registered for */}
          <Tabs.Panel value="attending">
            {regsQ.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : regsQ.isError ? (
              <ErrorState onRetry={() => void regsQ.refetch()} />
            ) : regsQ.data && regsQ.data.items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {regsQ.data.items.map((reg) => {
                  const ev = reg.event;
                  if (!ev) return null;
                  return (
                    <Card key={reg.id}>
                      <Card.Body className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link
                              to={`${BASE_PATH}/${ev.id}`}
                              className="text-base font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 no-underline"
                            >
                              {ev.title}
                            </Link>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              by {ev.host.name}
                            </p>
                          </div>
                          <Badge variant="success">Registered</Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <FiCalendar className="w-3.5 h-3.5" />{' '}
                            {format(new Date(ev.startAt), 'MMM d, yyyy')}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <FiMapPin className="w-3.5 h-3.5" /> {ev.mode}
                          </span>
                        </div>
                        <div className="flex justify-end pt-2 gap-2">
                          <Link
                            to={`${BASE_PATH}/${ev.id}`}
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium no-underline"
                          >
                            Details →
                          </Link>
                          <Button
                            size="sm"
                            variant="outline"
                            loading={unregisterMut.isPending && unregisterMut.variables === ev.id}
                            onClick={() => unregisterMut.mutate(ev.id)}
                          >
                            Unregister
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
                title="Not registered for any events"
                description="Browse published events and register to attend workshops and guest lectures."
              />
            )}
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>
    </div>
  );
}
