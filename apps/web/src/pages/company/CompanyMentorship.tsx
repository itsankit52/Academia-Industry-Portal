import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiX, FiCheckCircle, FiUsers } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  useMyRequestsAsMentor,
  useUpdateRequestStatus,
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

interface CompanyMentorshipProps {
  basePath?: string;
}

export default function CompanyMentorship({ basePath = '/company/mentorship' }: CompanyMentorshipProps = {}) {
  const [tab, setTab] = useState<'requests' | 'active'>('requests');
  const requested = useMyRequestsAsMentor({ status: 'REQUESTED', pageSize: 50 });
  const active = useMyRequestsAsMentor({ status: 'ACTIVE', pageSize: 50 });
  const statusMut = useUpdateRequestStatus();

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Mentorship" subtitle="Requests you have received and mentorships in progress." />

      <Tabs value={tab} onChange={(v) => setTab(v as typeof tab)}>
        <Tabs.List>
          <Tabs.Tab value="requests" label="Incoming Requests" />
          <Tabs.Tab value="active" label="Active Mentorships" />
        </Tabs.List>

        <Tabs.Panels className="mt-6">
          <Tabs.Panel value="requests">
            {requested.isLoading ? (
              <SkeletonCard />
            ) : requested.isError ? (
              <ErrorState onRetry={() => void requested.refetch()} />
            ) : requested.data && requested.data.items.length > 0 ? (
              <div className="space-y-3">
                {requested.data.items.map((r) => (
                  <Card key={r.id}>
                    <Card.Body className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{r.menteeName}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{r.menteeRole}</p>
                        </div>
                        <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{r.initialMessage}</p>
                      {r.goals && (
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Goals</p>
                          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{r.goals}</p>
                        </div>
                      )}
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          iconLeft={<FiX className="w-4 h-4" />}
                          loading={statusMut.isPending && statusMut.variables?.id === r.id && statusMut.variables.status === 'DECLINED'}
                          onClick={() => statusMut.mutate({ id: r.id, status: 'DECLINED' })}
                        >
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          iconLeft={<FiCheck className="w-4 h-4" />}
                          loading={statusMut.isPending && statusMut.variables?.id === r.id && statusMut.variables.status === 'ACCEPTED'}
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
              <EmptyState icon={<FiUsers />} title="No incoming requests" description="New mentorship requests will appear here." />
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
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{r.menteeName}</h3>
                        <Badge variant="success">ACTIVE</Badge>
                      </div>
                      {r.goals && <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{r.goals}</p>}
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
                          iconLeft={<FiCheckCircle className="w-4 h-4" />}
                          loading={statusMut.isPending && statusMut.variables?.id === r.id && statusMut.variables.status === 'COMPLETED'}
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
              <EmptyState title="No active mentorships" description="Accepted mentorships will appear here." />
            )}
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>
    </div>
  );
}
