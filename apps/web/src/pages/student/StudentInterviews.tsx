import { useState } from 'react';
import { FiCalendar } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import InterviewCard from '@/components/cards/InterviewCard';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useInterviews } from '@/hooks/queries/useInterviews';

export default function StudentInterviews() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const { data, isLoading, isError, refetch } = useInterviews(tab);
  const interviews = data?.items ?? [];

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Interviews" subtitle="View upcoming and past interview schedules." />

      <Tabs value={tab} onChange={(v) => setTab(v as 'upcoming' | 'past')}>
        <Tabs.List>
          <Tabs.Tab value="upcoming" label="Upcoming" />
          <Tabs.Tab value="past" label="Past" />
        </Tabs.List>

        <Tabs.Panels className="mt-6">
          <Tabs.Panel value={tab}>
            {isError && <ErrorState onRetry={() => void refetch()} />}

            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            )}

            {!isLoading && interviews.length === 0 && (
              <EmptyState
                icon={<FiCalendar />}
                title={tab === 'upcoming' ? 'No upcoming interviews' : 'No past interviews'}
                description={
                  tab === 'upcoming'
                    ? 'Interviews will appear here once scheduled by companies.'
                    : 'Completed and cancelled interviews appear here.'
                }
              />
            )}

            {interviews.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {interviews.map((interview) => (
                  <InterviewCard key={interview.id} interview={interview} />
                ))}
              </div>
            )}
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>
    </div>
  );
}
