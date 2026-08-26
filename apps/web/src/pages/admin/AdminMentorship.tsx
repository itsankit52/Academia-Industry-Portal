import { useMemo } from 'react';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAdminAllMentorships } from '@/hooks/queries/useMentorship';
import type { MentorshipStatus } from '@aip/config';

const statusVariant: Record<MentorshipStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  REQUESTED: 'warning',
  ACCEPTED: 'info',
  DECLINED: 'danger',
  ACTIVE: 'success',
  COMPLETED: 'default',
  CANCELLED: 'default',
};

export default function AdminMentorship() {
  const q = useAdminAllMentorships({ pageSize: 200 });

  const counts = useMemo(() => {
    const base: Record<MentorshipStatus, number> = {
      REQUESTED: 0, ACCEPTED: 0, DECLINED: 0, ACTIVE: 0, COMPLETED: 0, CANCELLED: 0,
    };
    for (const r of q.data?.items ?? []) base[r.status] = (base[r.status] ?? 0) + 1;
    return base;
  }, [q.data]);

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Mentorship" subtitle="Read-only view of all mentorship requests." />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(Object.keys(counts) as MentorshipStatus[]).map((s) => (
          <Card key={s}>
            <Card.Body className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">{s}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{counts[s]}</p>
            </Card.Body>
          </Card>
        ))}
      </div>

      {q.isLoading ? (
        <SkeletonCard />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : q.data && q.data.items.length > 0 ? (
        <Card>
          <Card.Body className="divide-y divide-slate-100 dark:divide-slate-800 -my-2">
            {q.data.items.map((r) => (
              <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {r.menteeName} → {r.mentorName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {r.menteeRole} · {format(new Date(r.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
                <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
              </div>
            ))}
          </Card.Body>
        </Card>
      ) : (
        <EmptyState title="No mentorships" description="No mentorship requests have been created yet." />
      )}
    </div>
  );
}
