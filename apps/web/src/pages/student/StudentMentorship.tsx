import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FiSearch, FiSend, FiUsers, FiStar } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Modal from '@/components/ui/Modal';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  useMentors,
  useMyRequestsAsMentee,
  useRequestMentorship,
  useRecommendedMentors,
  type RequestMentorshipInput,
} from '@/hooks/queries/useMentorship';
import type { MentorshipStatus } from '@aip/config';

const statusVariant: Record<MentorshipStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  REQUESTED: 'warning',
  ACCEPTED: 'info',
  DECLINED: 'danger',
  ACTIVE: 'success',
  COMPLETED: 'default',
  CANCELLED: 'default',
};

interface RequestFormValues {
  initialMessage: string;
  goals?: string;
}

interface StudentMentorshipProps {
  basePath?: string;
}

export default function StudentMentorship({ basePath = '/student/mentorship' }: StudentMentorshipProps = {}) {
  const [tab, setTab] = useState<'find' | 'recommended' | 'requests' | 'active'>('find');
  const [search, setSearch] = useState('');
  const [expertise, setExpertise] = useState('');
  const [selectedMentor, setSelectedMentor] = useState<{ userId: string; fullName: string } | null>(null);
  const requestMut = useRequestMentorship();
  const { register, handleSubmit, reset, formState } = useForm<RequestFormValues>();

  const mentors = useMentors({ search: search || undefined, expertise: expertise || undefined });
  const recommended = useRecommendedMentors();
  const mineAll = useMyRequestsAsMentee({ pageSize: 50 });
  const active = useMyRequestsAsMentee({ status: 'ACTIVE', pageSize: 50 });

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

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Mentorship"
        subtitle="Find a mentor and manage your mentorship threads."
      />

      <Tabs value={tab} onChange={(v) => setTab(v as typeof tab)}>
        <Tabs.List>
          <Tabs.Tab value="find" label="Find Mentor" />
          <Tabs.Tab value="recommended" label="Recommended" />
          <Tabs.Tab value="requests" label="My Requests" />
          <Tabs.Tab value="active" label="Active Mentorships" />
        </Tabs.List>

        <Tabs.Panels className="mt-6">
          <Tabs.Panel value="find">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_240px] gap-3 mb-4">
              <Input
                placeholder="Search by name, bio, or expertise..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                iconLeft={<FiSearch className="w-4 h-4" />}
              />
              <Input
                placeholder="Filter by expertise (e.g. react)"
                value={expertise}
                onChange={(e) => setExpertise(e.target.value)}
              />
            </div>

            {mentors.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : mentors.isError ? (
              <ErrorState onRetry={() => void mentors.refetch()} />
            ) : mentors.data && mentors.data.items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mentors.data.items.map((m) => (
                  <Card key={m.id}>
                    <Card.Body className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{m.fullName}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {typeof m.yearsExperience === 'number' ? `${m.yearsExperience} yrs experience` : '—'}
                          </p>
                        </div>
                        <Badge variant={m.availability === 'AVAILABLE' ? 'success' : 'default'} size="sm">
                          {m.availability}
                        </Badge>
                      </div>
                      {m.bio && (
                        <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">{m.bio}</p>
                      )}
                      {m.expertise.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {m.expertise.slice(0, 6).map((tag) => (
                            <Badge key={tag} variant="info" size="sm">{tag}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {m.activeCount ?? 0} / {m.mentorshipCapacity} active
                        </span>
                        <Button
                          size="sm"
                          onClick={() => setSelectedMentor({ userId: m.userId, fullName: m.fullName })}
                          disabled={m.availability !== 'AVAILABLE'}
                        >
                          Request Mentorship
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState icon={<FiUsers />} title="No mentors match" description="Try adjusting your filters." />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="recommended">
            {recommended.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : recommended.isError ? (
              <ErrorState onRetry={() => void recommended.refetch()} />
            ) : recommended.data && recommended.data.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <FiStar className="w-4 h-4 text-amber-500" />
                  <span>Ranked by relevance to your skills and interests.</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommended.data.map((m) => (
                    <Card key={m.id}>
                      <Card.Body className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{m.fullName}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {typeof m.yearsExperience === 'number' ? `${m.yearsExperience} yrs experience` : '—'}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="info" size="sm" className="font-mono">
                              {Math.round(m.score)} pts
                            </Badge>
                            <Badge variant={m.availability === 'AVAILABLE' ? 'success' : 'default'} size="sm">
                              {m.availability}
                            </Badge>
                          </div>
                        </div>
                        {m.bio && (
                          <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{m.bio}</p>
                        )}
                        {m.expertise.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {m.expertise.slice(0, 6).map((tag) => (
                              <Badge key={tag} variant="info" size="sm">{tag}</Badge>
                            ))}
                          </div>
                        )}
                        {m.reasons.length > 0 && (
                          <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5 pl-3 list-disc">
                            {m.reasons.slice(0, 3).map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        )}
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {m.activeCount ?? 0} / {m.mentorshipCapacity} active
                          </span>
                          <Button
                            size="sm"
                            onClick={() => setSelectedMentor({ userId: m.userId, fullName: m.fullName })}
                            disabled={m.availability !== 'AVAILABLE'}
                          >
                            Request Mentorship
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<FiStar />}
                title="No recommendations yet"
                description="Add skills and interests to your profile to see mentor matches."
              />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="requests">
            {mineAll.isLoading ? (
              <SkeletonCard />
            ) : mineAll.isError ? (
              <ErrorState onRetry={() => void mineAll.refetch()} />
            ) : mineAll.data && mineAll.data.items.length > 0 ? (
              <Card>
                <Card.Body className="divide-y divide-slate-100 dark:divide-slate-800 -my-2">
                  {mineAll.data.items.map((r) => (
                    <Link
                      key={r.id}
                      to={`${basePath}/${r.id}`}
                      className="py-3 flex items-center justify-between no-underline hover:bg-slate-50 dark:hover:bg-slate-800 -mx-6 px-6"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.mentorName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {r.initialMessage}
                        </p>
                      </div>
                      <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
                    </Link>
                  ))}
                </Card.Body>
              </Card>
            ) : (
              <EmptyState title="No requests yet" description="Send your first mentorship request from the Find tab." />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="active">
            {active.isLoading ? (
              <SkeletonCard />
            ) : active.isError ? (
              <ErrorState onRetry={() => void active.refetch()} />
            ) : active.data && active.data.items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {active.data.items.map((r) => (
                  <Card key={r.id}>
                    <Card.Body className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{r.mentorName}</h3>
                        <Badge variant="success">ACTIVE</Badge>
                      </div>
                      {r.goals && <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{r.goals}</p>}
                      <Link
                        to={`${basePath}/${r.id}`}
                        className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium no-underline pt-1"
                      >
                        Open thread <FiSend className="w-4 h-4" />
                      </Link>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title="No active mentorships" description="Once a mentor accepts a request, it will show here." />
            )}
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>

      <Modal open={!!selectedMentor} onClose={() => setSelectedMentor(null)} title={`Request mentorship from ${selectedMentor?.fullName ?? ''}`}>
        <form onSubmit={onSubmitRequest} className="space-y-4">
          <Textarea
            label="Introduce yourself"
            required
            rows={4}
            placeholder="Briefly say why you want mentorship and what you hope to work on."
            error={formState.errors.initialMessage?.message}
            {...register('initialMessage', { required: 'Message is required', maxLength: { value: 1000, message: 'Max 1000 characters' } })}
          />
          <Textarea
            label="Goals (optional)"
            rows={3}
            placeholder="Concrete outcomes you would like from this mentorship."
            {...register('goals', { maxLength: { value: 2000, message: 'Max 2000 characters' } })}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSelectedMentor(null)}>Cancel</Button>
            <Button type="submit" loading={requestMut.isPending}>Send Request</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
