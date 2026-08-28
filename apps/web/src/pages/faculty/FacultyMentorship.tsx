import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FiSearch, FiSend, FiUsers, FiCheck, FiX } from 'react-icons/fi';
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
  useMyRequestsAsMentor,
  useRequestMentorship,
  useUpdateRequestStatus,
  type RequestMentorshipInput,
} from '@/hooks/queries/useMentorship';
import type { MentorshipStatus } from '@aip/config';

const statusVariant: Record<
  MentorshipStatus,
  'default' | 'success' | 'warning' | 'danger' | 'info'
> = {
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

const BASE_PATH = '/faculty/mentorship';

export default function FacultyMentorship() {
  const [tab, setTab] = useState<'mentee' | 'mentor'>('mentee');
  // Mentee state
  const [search, setSearch] = useState('');
  const [expertise, setExpertise] = useState('');
  const [selectedMentor, setSelectedMentor] = useState<{ userId: string; fullName: string } | null>(
    null,
  );
  const requestMut = useRequestMentorship();
  const { register, handleSubmit, reset, formState } = useForm<RequestFormValues>();

  const mentors = useMentors({ search: search || undefined, expertise: expertise || undefined });
  const menteeRequests = useMyRequestsAsMentee({ pageSize: 50 });
  const menteeActive = useMyRequestsAsMentee({ status: 'ACTIVE', pageSize: 50 });

  // Mentor state
  const mentorRequested = useMyRequestsAsMentor({ status: 'REQUESTED', pageSize: 50 });
  const mentorActive = useMyRequestsAsMentor({ status: 'ACTIVE', pageSize: 50 });
  const statusMut = useUpdateRequestStatus();

  const onSubmit = handleSubmit((values) => {
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
        subtitle="Connect with industry mentors and manage your mentorship relationships."
      />

      <Tabs value={tab} onChange={(v) => setTab(v as typeof tab)}>
        <Tabs.List>
          <Tabs.Tab value="mentee" label="As Mentee" />
          <Tabs.Tab value="mentor" label="As Mentor" />
        </Tabs.List>

        <Tabs.Panels className="mt-6">
          {/* As Mentee: find mentors, send requests, view active */}
          <Tabs.Panel value="mentee">
            <MenteeContent
              basePath={BASE_PATH}
              mentors={mentors}
              menteeRequests={menteeRequests}
              menteeActive={menteeActive}
              search={search}
              setSearch={setSearch}
              expertise={expertise}
              setExpertise={setExpertise}
              setSelectedMentor={setSelectedMentor}
            />
          </Tabs.Panel>

          {/* As Mentor: incoming requests, active mentorships */}
          <Tabs.Panel value="mentor">
            <MentorContent
              basePath={BASE_PATH}
              mentorRequested={mentorRequested}
              mentorActive={mentorActive}
              statusMut={statusMut}
            />
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>

      <Modal
        open={!!selectedMentor}
        onClose={() => setSelectedMentor(null)}
        title={`Request mentorship from ${selectedMentor?.fullName ?? ''}`}
      >
        <form onSubmit={onSubmit} className="space-y-4">
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

function MenteeContent({
  basePath,
  mentors,
  menteeRequests,
  menteeActive,
  search,
  setSearch,
  expertise,
  setExpertise,
  setSelectedMentor,
}: {
  basePath: string;
  mentors: ReturnType<typeof useMentors>;
  menteeRequests: ReturnType<typeof useMyRequestsAsMentee>;
  menteeActive: ReturnType<typeof useMyRequestsAsMentee>;
  search: string;
  setSearch: (v: string) => void;
  expertise: string;
  setExpertise: (v: string) => void;
  setSelectedMentor: (v: { userId: string; fullName: string } | null) => void;
}) {
  const [subTab, setSubTab] = useState<'find' | 'requests'>('find');

  return (
    <>
      <Tabs value={subTab} onChange={(v) => setSubTab(v as typeof subTab)}>
        <Tabs.List>
          <Tabs.Tab value="find" label="Find Mentor" />
          <Tabs.Tab value="requests" label="My Requests" />
        </Tabs.List>
        <Tabs.Panels className="mt-4">
          <Tabs.Panel value="find">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_240px] gap-3 mb-4">
              <Input
                placeholder="Search by name, bio, or expertise..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                iconLeft={<FiSearch className="w-4 h-4" />}
              />
              <Input
                placeholder="Filter by expertise"
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
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            {m.fullName}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {typeof m.yearsExperience === 'number'
                              ? `${m.yearsExperience} yrs experience`
                              : '—'}
                          </p>
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
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {m.activeCount ?? 0} / {m.mentorshipCapacity} active
                        </span>
                        <Button
                          size="sm"
                          onClick={() =>
                            setSelectedMentor({ userId: m.userId, fullName: m.fullName })
                          }
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
              <EmptyState
                icon={<FiUsers />}
                title="No mentors match"
                description="Try adjusting your filters."
              />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="requests">
            {menteeRequests.isLoading ? (
              <SkeletonCard />
            ) : menteeRequests.isError ? (
              <ErrorState onRetry={() => void menteeRequests.refetch()} />
            ) : menteeRequests.data && menteeRequests.data.items.length > 0 ? (
              <div className="space-y-3">
                {menteeRequests.data.items.map((r) => (
                  <Card key={r.id}>
                    <Card.Body className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            {r.mentorName}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {r.initialMessage}
                          </p>
                        </div>
                        <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
                      </div>
                      {r.goals && (
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Goals</p>
                          <p className="text-sm text-slate-700 dark:text-slate-300">{r.goals}</p>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No requests yet"
                description="Send your first mentorship request from the Find tab."
              />
            )}

            {menteeActive.data && menteeActive.data.items.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-6 mb-3">
                  Active Mentorships
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {menteeActive.data.items.map((r) => (
                    <Card key={r.id}>
                      <Card.Body className="space-y-2">
                        <div className="flex items-start justify-between">
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            {r.mentorName}
                          </h3>
                          <Badge variant="success">ACTIVE</Badge>
                        </div>
                        {r.goals && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                            {r.goals}
                          </p>
                        )}
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
              </>
            )}
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>
    </>
  );
}

function MentorContent({
  basePath,
  mentorRequested,
  mentorActive,
  statusMut,
}: {
  basePath: string;
  mentorRequested: ReturnType<typeof useMyRequestsAsMentor>;
  mentorActive: ReturnType<typeof useMyRequestsAsMentor>;
  statusMut: ReturnType<typeof useUpdateRequestStatus>;
}) {
  const [subTab, setSubTab] = useState<'requests' | 'active'>('requests');

  return (
    <>
      <Tabs value={subTab} onChange={(v) => setSubTab(v as typeof subTab)}>
        <Tabs.List>
          <Tabs.Tab value="requests" label="Incoming Requests" />
          <Tabs.Tab value="active" label="Active Mentorships" />
        </Tabs.List>
        <Tabs.Panels className="mt-4">
          <Tabs.Panel value="requests">
            {mentorRequested.isLoading ? (
              <SkeletonCard />
            ) : mentorRequested.isError ? (
              <ErrorState onRetry={() => void mentorRequested.refetch()} />
            ) : mentorRequested.data && mentorRequested.data.items.length > 0 ? (
              <div className="space-y-3">
                {mentorRequested.data.items.map((r) => (
                  <Card key={r.id}>
                    <Card.Body className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            {r.menteeName}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {r.menteeRole}
                          </p>
                        </div>
                        <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                        {r.initialMessage}
                      </p>
                      {r.goals && (
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Goals</p>
                          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {r.goals}
                          </p>
                        </div>
                      )}
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          iconLeft={<FiX className="w-4 h-4" />}
                          loading={
                            statusMut.isPending &&
                            statusMut.variables?.id === r.id &&
                            statusMut.variables.status === 'DECLINED'
                          }
                          onClick={() => statusMut.mutate({ id: r.id, status: 'DECLINED' })}
                        >
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          iconLeft={<FiCheck className="w-4 h-4" />}
                          loading={
                            statusMut.isPending &&
                            statusMut.variables?.id === r.id &&
                            statusMut.variables.status === 'ACCEPTED'
                          }
                          onClick={() => statusMut.mutate({ id: r.id, status: 'ACCEPTED' })}
                        >
                          Accept
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<FiUsers />}
                title="No incoming requests"
                description="New mentorship requests will appear here."
              />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="active">
            {mentorActive.isLoading ? (
              <SkeletonCard />
            ) : mentorActive.isError ? (
              <ErrorState onRetry={() => void mentorActive.refetch()} />
            ) : mentorActive.data && mentorActive.data.items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mentorActive.data.items.map((r) => (
                  <Card key={r.id}>
                    <Card.Body className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          {r.menteeName}
                        </h3>
                        <Badge variant="success">ACTIVE</Badge>
                      </div>
                      {r.goals && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                          {r.goals}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-2">
                        <Link
                          to={`${basePath}/${r.id}`}
                          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium no-underline"
                        >
                          Open thread →
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={
                            statusMut.isPending &&
                            statusMut.variables?.id === r.id &&
                            statusMut.variables.status === 'COMPLETED'
                          }
                          onClick={() => statusMut.mutate({ id: r.id, status: 'COMPLETED' })}
                        >
                          Complete
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No active mentorships"
                description="Accepted mentorships will appear here."
              />
            )}
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>
    </>
  );
}
