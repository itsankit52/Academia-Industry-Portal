import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { FiCalendar, FiMapPin, FiUsers, FiSearch, FiUsers as FiMentorship } from 'react-icons/fi';
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
import {
  useMentors,
  useRequestMentorship,
  type RequestMentorshipInput,
} from '@/hooks/queries/useMentorship';
import { useAuthStore } from '@/store/auth';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import { useForm } from 'react-hook-form';
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

function EventCard({
  ev,
  registered,
  onRegister,
}: {
  ev: {
    id: string;
    title: string;
    description: string;
    eventType: string;
    startAt: string;
    mode: string;
    location?: string;
    capacity?: number;
    registeredCount: number;
    host: { name: string } | string;
  };
  registered: boolean;
  onRegister: (id: string) => void;
}) {
  const host = typeof ev.host === 'string' ? ev.host : ev.host.name;
  const full = typeof ev.capacity === 'number' && ev.registeredCount >= ev.capacity;
  return (
    <Card>
      <Card.Body className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{ev.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">by {host}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="info" size="sm">
            {ev.eventType.replace(/_/g, ' ')}
          </Badge>
          <Badge variant="default" size="sm">
            {ev.mode}
          </Badge>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">{ev.description}</p>
        <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <FiCalendar className="w-3.5 h-3.5" /> {format(new Date(ev.startAt), 'MMM d, yyyy')}
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
        <div className="flex justify-end pt-1">
          {registered ? (
            <Badge variant="success">Registered</Badge>
          ) : (
            <Button size="sm" disabled={full} onClick={() => onRegister(ev.id)}>
              {full ? 'Full' : 'Register'}
            </Button>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

function MentorCard({
  mentor,
  onRequest,
}: {
  mentor: {
    id: string;
    userId: string;
    fullName: string;
    bio?: string;
    expertise: string[];
    yearsExperience?: number;
    availability: string;
    mentorshipCapacity: number;
    activeCount: number;
  };
  onRequest: (m: { userId: string; fullName: string }) => void;
}) {
  return (
    <Card>
      <Card.Body className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {mentor.fullName}
            </h3>
            {typeof mentor.yearsExperience === 'number' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mentor.yearsExperience} yrs experience
              </p>
            )}
          </div>
          <Badge variant={mentor.availability === 'AVAILABLE' ? 'success' : 'default'} size="sm">
            {mentor.availability}
          </Badge>
        </div>
        {mentor.bio && (
          <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">{mentor.bio}</p>
        )}
        {mentor.expertise.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mentor.expertise.slice(0, 6).map((tag) => (
              <Badge key={tag} variant="info" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {mentor.activeCount} / {mentor.mentorshipCapacity} active
          </span>
          <Button
            size="sm"
            onClick={() => onRequest({ userId: mentor.userId, fullName: mentor.fullName })}
            disabled={mentor.availability !== 'AVAILABLE'}
          >
            Request Mentorship
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}

interface RequestFormValues {
  initialMessage: string;
  goals?: string;
}

export default function StudentCollaborationHub() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<CollabTab>('all');
  const [search, setSearch] = useState('');
  const [selectedMentor, setSelectedMentor] = useState<{ userId: string; fullName: string } | null>(
    null,
  );

  const { register, handleSubmit, reset, formState } = useForm<RequestFormValues>();
  const requestMut = useRequestMentorship();

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

  const onSubmitRequest = handleSubmit((values) => {
    if (!selectedMentor) return;
    const payload: RequestMentorshipInput = {
      mentorUserId: selectedMentor.userId,
      initialMessage: values.initialMessage,
      ...(values.goals ? { goals: values.goals } : {}),
    };
    requestMut.mutate(payload, {
      onSuccess: () => {
        setSelectedMentor(null);
        reset();
      },
    });
  });

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
        subtitle="Discover workshops, guest lectures, live projects, innovation challenges, training programs, research collaborations, and mentorship."
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

          {/* Events tab content */}
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
                  {eventsQ.data.items.map((ev) => (
                    <EventCard
                      key={ev.id}
                      ev={ev as Parameters<typeof EventCard>[0]['ev']}
                      registered={registeredIds.has(ev.id)}
                      onRegister={handleRegister}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<FiCalendar />}
                  title={`No ${TAB_LABELS[tab] === 'All' ? '' : TAB_LABELS[tab].toLowerCase()} events found`}
                  description="Try clearing your search or switching tabs."
                />
              )}
            </>
          )}

          {/* Mentorship tab content */}
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
                    <MentorCard
                      key={m.id}
                      mentor={m as Parameters<typeof MentorCard>[0]['mentor']}
                      onRequest={setSelectedMentor}
                    />
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

      {/* Mentorship Request Modal */}
      <Modal
        open={!!selectedMentor}
        onClose={() => setSelectedMentor(null)}
        title={`Request mentorship from ${selectedMentor?.fullName ?? ''}`}
      >
        <form onSubmit={onSubmitRequest} className="space-y-4">
          <Textarea
            label="Introduce yourself"
            required
            rows={4}
            placeholder="Briefly say why you want mentorship and what you hope to work on."
            error={formState.errors.initialMessage?.message}
            {...register('initialMessage', {
              required: 'Message is required',
              maxLength: { value: 1000, message: 'Max 1000 characters' },
            })}
          />
          <Textarea
            label="Goals (optional)"
            rows={3}
            placeholder="Concrete outcomes you would like from this mentorship."
            {...register('goals', { maxLength: { value: 2000, message: 'Max 2000 characters' } })}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSelectedMentor(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={requestMut.isPending}>
              Send Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
