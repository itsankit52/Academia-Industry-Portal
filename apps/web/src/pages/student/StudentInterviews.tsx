import { useState } from 'react';
import { Link } from 'react-router-dom';
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
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
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
                  // The details link sits beside the card rather than wrapping it:
                  // `InterviewCard` already renders its own anchor for the meeting
                  // link, and nesting anchors would swallow that click. This mirrors
                  // how CompanyInterviews places its per-interview actions.
                  <div key={interview.id} className="space-y-2">
                    <InterviewCard interview={interview} />
                    <div className="px-1">
                      <Link
                        to={`/student/interviews/${interview.id}`}
                        className="text-xs text-indigo-600 hover:text-indigo-700 no-underline dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        View details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>
    </div>
  );
}
