import { useNavigate, useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { FiArrowLeft, FiEdit2, FiCheckCircle, FiXCircle, FiSend, FiUserPlus } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import {
  useEvent,
  useEventRegistrations,
  usePublishEvent,
  useCancelEvent,
  useMarkAttended,
  useRegisterForEvent,
  useUnregisterFromEvent,
  useMyRegistrations,
} from '@/hooks/queries/useEvents';

const BASE_PATH = '/faculty/events';

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  CANCELLED: 'danger',
  COMPLETED: 'info',
};

export default function FacultyEventDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const eventQ = useEvent(id ?? '');
  const regsQ = useEventRegistrations(id ?? '', { pageSize: 200 });
  const publishMut = usePublishEvent();
  const cancelMut = useCancelEvent();
  const attendMut = useMarkAttended(id ?? '');
  const registerMut = useRegisterForEvent();
  const unregisterMut = useUnregisterFromEvent();
  const myRegsQ = useMyRegistrations({ pageSize: 200 });

  if (eventQ.isLoading) {
    return (
      <div className="container-page py-8">
        <SkeletonCard />
      </div>
    );
  }
  if (eventQ.isError || !eventQ.data) {
    return (
      <div className="container-page py-8">
        <ErrorState onRetry={() => void eventQ.refetch()} />
      </div>
    );
  }

  const ev = eventQ.data;
  const hostName =
    typeof ev.host === 'string' ? ev.host : ((ev.host as { name?: string }).name ?? '—');
  // Use registrations to detect if the current user already registered
  const registeredIds = new Set(
    (myRegsQ.data?.items ?? []).filter((r) => r.event).map((r) => r.event!.id),
  );
  const amIRegistered = registeredIds.has(ev.id);

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title={ev.title}
        subtitle={`Hosted by ${hostName}`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<FiArrowLeft className="w-4 h-4" />}
              onClick={() => navigate(BASE_PATH)}
            >
              Back
            </Button>
            <Link
              to={`${BASE_PATH}/${ev.id}/edit`}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 no-underline dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <FiEdit2 className="w-4 h-4" /> Edit
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-4">
          <Card>
            <Card.Body className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={statusVariant[ev.status] ?? 'default'}>{ev.status}</Badge>
                <Badge variant="info" size="sm">
                  {ev.eventType.replace(/_/g, ' ')}
                </Badge>
                <Badge variant="default" size="sm">
                  {ev.mode}
                </Badge>
              </div>
              <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {ev.description}
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-700 dark:text-slate-300 pt-2">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Starts</p>
                  <p>{format(new Date(ev.startAt), 'PPP p')}</p>
                </div>
                {ev.endAt && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Ends</p>
                    <p>{format(new Date(ev.endAt), 'PPP p')}</p>
                  </div>
                )}
                {ev.location && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Location</p>
                    <p>{ev.location}</p>
                  </div>
                )}
                {ev.meetingLink && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Meeting</p>
                    <a
                      href={ev.meetingLink}
                      className="text-indigo-600 hover:text-indigo-700 no-underline break-all"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {ev.meetingLink}
                    </a>
                  </div>
                )}
                {typeof ev.capacity === 'number' && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Capacity</p>
                    <p>
                      {ev.registeredCount}/{ev.capacity}
                    </p>
                  </div>
                )}
                {ev.registrationDeadline && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Registration deadline
                    </p>
                    <p>{format(new Date(ev.registrationDeadline), 'PPP p')}</p>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Registrations
              </h2>
            </Card.Header>
            <Card.Body>
              {regsQ.isLoading ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
              ) : regsQ.data && regsQ.data.items.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 -my-2">
                  {regsQ.data.items.map((r) => (
                    <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 dark:text-slate-100 truncate">
                          {r.user?.email ?? 'Unknown'}{' '}
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            ({r.user?.role})
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Registered {format(new Date(r.registeredAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                      {r.attendedAt ? (
                        <Badge variant="success" size="sm">
                          <FiCheckCircle className="w-3 h-3 mr-1" /> Attended
                        </Badge>
                      ) : (
                        r.user && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={
                              attendMut.isPending &&
                              attendMut.variables === (r.user as { id?: string }).id
                            }
                            onClick={() => attendMut.mutate((r.user as { id?: string }).id ?? '')}
                          >
                            Mark attended
                          </Button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No registrations yet"
                  description="Once someone registers, they'll appear here."
                />
              )}
            </Card.Body>
          </Card>
        </div>

        <Card>
          <Card.Header>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Actions
            </h2>
          </Card.Header>
          <Card.Body className="space-y-2">
            <Button
              className="w-full"
              iconLeft={<FiSend className="w-4 h-4" />}
              disabled={ev.status !== 'DRAFT'}
              loading={publishMut.isPending}
              onClick={() => publishMut.mutate(ev.id)}
            >
              Publish
            </Button>
            <Button
              className="w-full"
              variant="danger"
              iconLeft={<FiXCircle className="w-4 h-4" />}
              disabled={ev.status === 'CANCELLED' || ev.status === 'COMPLETED'}
              loading={cancelMut.isPending}
              onClick={() => cancelMut.mutate(ev.id)}
            >
              Cancel Event
            </Button>
            {ev.status === 'PUBLISHED' &&
              (amIRegistered ? (
                <Button
                  className="w-full"
                  variant="outline"
                  iconLeft={<FiXCircle className="w-4 h-4" />}
                  loading={unregisterMut.isPending}
                  onClick={() => unregisterMut.mutate(ev.id)}
                >
                  Unregister
                </Button>
              ) : (
                <Button
                  className="w-full"
                  iconLeft={<FiUserPlus className="w-4 h-4" />}
                  loading={registerMut.isPending}
                  onClick={() => registerMut.mutate(ev.id)}
                >
                  Register
                </Button>
              ))}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
