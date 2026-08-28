import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  FiCalendar,
  FiMapPin,
  FiUsers,
  FiSearch,
  FiUsers as FiMentorship,
  FiEdit2,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  useEvents,
  useRegisterForEvent,
  useMyRegistrations,
  type EventFilters,
} from '@/hooks/queries/useEvents';
import { useMentors } from '@/hooks/queries/useMentorship';
import type { CollabEventType } from '@aip/config';
import { useAuthStore } from '@/store/auth';

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
  all: 'All',
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

export default function FacultyCollaborationHub() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<CollabTab>('all');
  const [search, setSearch] = useState('');

  const eventFilters: EventFilters = {
    pageSize: 24,
    ...(search ? { search } : {}),
    ...(tab !== 'all' && tab !== 'mentorship' ? { eventType: tab as CollabEventType } : {}),
  };
  const eventsQ = useEvents(eventFilters);
  const regsQ = useMyRegistrations({ pageSize: 200 });
  const registerMut = useRegisterForEvent();

  const mentorsQ = useMentors({ search: search || undefined, pageSize: 12 });

  const registeredIds = new Set(
    (regsQ.data?.items ?? []).map((r) => (r.event ? r.event.id : '')).filter(Boolean),
  );

  const handleRegister = (id: string) => {
    if (!user) {
      navigate('/login');
      return;
    }
    registerMut.mutate(id);
  };

  const isMentorshipTab = tab === 'mentorship';
  const showEvents = !isMentorshipTab;
  const showMentorship = isMentorshipTab;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Collaboration Hub"
        subtitle="Industry–academia collaboration: workshops, guest lectures, projects, challenges, training, research, and mentorship."
        actions={
          <Link
            to="/faculty/events/new"
            className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 no-underline"
          >
            <FiEdit2 className="w-4 h-4" /> Host Event
          </Link>
        }
      />

      <Tabs value={tab} onChange={(v) => setTab(v as CollabTab)}>
        <Tabs.List className="flex flex-wrap gap-1">
          {COLLAB_TABS.map((t) => (
            <Tabs.Tab key={t} value={t} label={TAB_LABELS[t]} />
          ))}
        </Tabs.List>

        <div className="mt-4 space-y-4">
          <Input
            placeholder={`Search ${isMentorshipTab ? 'mentors' : 'events'}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            iconLeft={<FiSearch className="w-4 h-4" />}
          />

          {showEvents && (
            <>
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
                    const full =
                      typeof ev.capacity === 'number' && ev.registeredCount >= ev.capacity;
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
                          <div className="flex justify-end pt-1">
                            {registeredIds.has(ev.id) ? (
                              <Badge variant="success">Registered</Badge>
                            ) : (
                              <Button
                                size="sm"
                                disabled={full}
                                onClick={() => handleRegister(ev.id)}
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
                <EmptyState
                  icon={<FiCalendar />}
                  title="No events found"
                  description="Try clearing your search or switching tabs."
                />
              )}
            </>
          )}

          {showMentorship && (
            <>
              {mentorsQ.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : mentorsQ.isError ? (
                <ErrorState onRetry={() => void mentorsQ.refetch()} />
              ) : mentorsQ.data && mentorsQ.data.items.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mentorsQ.data.items.map((m) => (
                    <Card key={m.id}>
                      <Card.Body className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                              {m.fullName}
                            </h3>
                            {typeof m.yearsExperience === 'number' && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {m.yearsExperience} yrs experience
                              </p>
                            )}
                          </div>
                          <Badge
                            variant={m.availability === 'AVAILABLE' ? 'success' : 'default'}
                            size="sm"
                          >
                            {m.availability}
                          </Badge>
                        </div>
                        {m.bio && (
                          <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">
                            {m.bio}
                          </p>
                        )}
                        {m.expertise.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {m.expertise.slice(0, 6).map((tag) => (
                              <Badge key={tag} variant="info" size="sm">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {m.activeCount} / {m.mentorshipCapacity} active
                          </span>
                          <Link
                            to="/faculty/mentorship"
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium no-underline"
                          >
                            Request →
                          </Link>
                        </div>
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<FiMentorship />}
                  title="No mentors available"
                  description="Check back later or try a different search term."
                />
              )}
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
