import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { FiCalendar, FiMapPin, FiUsers, FiSearch, FiUsers as FiMentorship } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useEvents, type EventFilters } from '@/hooks/queries/useEvents';
import { useAdminAllMentorships } from '@/hooks/queries/useMentorship';
import type { CollabEventType } from '@aip/config';

type CollabTab =
  | 'all'
  | 'WORKSHOP'
  | 'GUEST_LECTURE'
  | 'LIVE_PROJECT'
  | 'INNOVATION_CHALLENGE'
  | 'TRAINING_PROGRAM'
  | 'RESEARCH_COLLABORATION'
  | 'mentorship';

const TAB_LABELS: Record<CollabTab, string> = {
  all: 'All Events',
  WORKSHOP: 'Workshops',
  GUEST_LECTURE: 'Guest Lectures',
  LIVE_PROJECT: 'Live Projects',
  INNOVATION_CHALLENGE: 'Innovation Challenges',
  TRAINING_PROGRAM: 'Training Programs',
  RESEARCH_COLLABORATION: 'Research Collab',
  mentorship: 'Mentorship',
};

const COLLAB_TABS: CollabTab[] = [
  'all',
  'WORKSHOP',
  'GUEST_LECTURE',
  'LIVE_PROJECT',
  'INNOVATION_CHALLENGE',
  'TRAINING_PROGRAM',
  'RESEARCH_COLLABORATION',
  'mentorship',
];

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  CANCELLED: 'danger',
  COMPLETED: 'info',
};

export default function AdminCollaborationHub() {
  const [tab, setTab] = useState<CollabTab>('all');
  const [search, setSearch] = useState('');

  const isMentorshipTab = tab === 'mentorship';
  const showEvents = !isMentorshipTab;

  const eventFilters: EventFilters = {
    pageSize: 50,
    ...(search ? { search } : {}),
    ...(tab !== 'all' ? { eventType: tab as CollabEventType } : {}),
  };
  const eventsQ = useEvents(eventFilters);
  const mentorshipQ = useAdminAllMentorships({ pageSize: 100 });

  // Aggregate counts by type for a quick dashboard view
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ev of eventsQ.data?.items ?? []) {
      counts[ev.eventType] = (counts[ev.eventType] ?? 0) + 1;
    }
    return counts;
  }, [eventsQ.data]);

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Collaboration Hub"
        subtitle="Platform-wide view of industry–academia collaboration: events and mentorship across all hosts."
      />

      <Tabs value={tab} onChange={(v) => setTab(v as CollabTab)}>
        <Tabs.List className="flex flex-wrap gap-1">
          {COLLAB_TABS.map((t) => (
            <Tabs.Tab key={t} value={t} label={TAB_LABELS[t]} />
          ))}
        </Tabs.List>

        <div className="mt-4 space-y-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${isMentorshipTab ? 'mentorships' : 'events'}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full pl-9"
            />
          </div>

          {showEvents && (
            <>
              {/* Aggregated type summary */}
              {!search && eventsQ.data && eventsQ.data.items.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {COLLAB_TABS.filter((t): t is CollabTab => t !== 'all' && t !== 'mentorship').map(
                    (t) => (
                      <Card key={t}>
                        <Card.Body className="text-center">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {TAB_LABELS[t]}
                          </p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                            {typeCounts[t] ?? 0}
                          </p>
                        </Card.Body>
                      </Card>
                    ),
                  )}
                </div>
              )}

              {eventsQ.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : eventsQ.isError ? (
                <ErrorState onRetry={() => void eventsQ.refetch()} />
              ) : eventsQ.data && eventsQ.data.items.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {eventsQ.data.items.map((ev) => {
                    const host = typeof ev.host === 'string' ? ev.host : ev.host.name;
                    return (
                      <Card key={ev.id}>
                        <Card.Body className="space-y-3">
                          <div>
                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                              {ev.title}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              by {host}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="info" size="sm">
                              {ev.eventType.replace(/_/g, ' ')}
                            </Badge>
                            <Badge variant="default" size="sm">
                              {ev.mode}
                            </Badge>
                            <Badge variant={statusVariant[ev.status] ?? 'default'} size="sm">
                              {ev.status}
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
                                <FiUsers className="w-3.5 h-3.5" /> {ev.registeredCount}/
                                {ev.capacity}
                              </span>
                            )}
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
                  description="Try clearing your search or switching tabs."
                />
              )}
            </>
          )}

          {!showEvents && (
            <>
              {mentorshipQ.isLoading ? (
                <SkeletonCard />
              ) : mentorshipQ.isError ? (
                <ErrorState onRetry={() => void mentorshipQ.refetch()} />
              ) : mentorshipQ.data && mentorshipQ.data.items.length > 0 ? (
                <Card>
                  <Card.Body className="divide-y divide-slate-100 dark:divide-slate-800 -my-2">
                    {mentorshipQ.data.items.map((r) => (
                      <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {r.menteeName} → {r.mentorName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {r.menteeRole} · {format(new Date(r.createdAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <Badge
                          variant={
                            r.status === 'ACTIVE'
                              ? 'success'
                              : r.status === 'REQUESTED'
                                ? 'warning'
                                : 'default'
                          }
                        >
                          {r.status}
                        </Badge>
                      </div>
                    ))}
                  </Card.Body>
                </Card>
              ) : (
                <EmptyState
                  icon={<FiMentorship />}
                  title="No mentorship requests"
                  description="No mentorship activity platform-wide yet."
                />
              )}
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
