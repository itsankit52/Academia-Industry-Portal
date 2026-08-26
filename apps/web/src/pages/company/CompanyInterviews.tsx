import { useState } from 'react';
import { FiCalendar } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import InterviewCard from '@/components/cards/InterviewCard';
import RescheduleInterviewModal from '@/components/features/RescheduleInterviewModal';
import InterviewFeedbackModal from '@/components/features/InterviewFeedbackModal';
import { useCompanyInterviews, useCancelInterview } from '@/hooks/queries/useCompanyInterviews';
import type { Interview } from '@aip/types';

export default function CompanyInterviews() {
  const [tab, setTab] = useState('upcoming');
  const { data, isLoading, isError, refetch } = useCompanyInterviews(tab);
  const interviews = data?.items ?? [];
  const cancelInterview = useCancelInterview();
  const [rescheduleTarget, setRescheduleTarget] = useState<Interview | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<Interview | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Interview | null>(null);

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Interviews" subtitle="Manage scheduled and completed interviews." />

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="upcoming" label="Upcoming" />
          <Tabs.Tab value="past" label="Past" />
        </Tabs.List>
        <Tabs.Panels className="mt-6">
          <Tabs.Panel value={tab}>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : interviews.length === 0 ? (
              <EmptyState icon={<FiCalendar />} title={tab === 'upcoming' ? 'No upcoming interviews' : 'No past interviews'} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {interviews.map((iv) => (
                  <div key={iv.id} className="space-y-2">
                    <InterviewCard interview={iv} />
                    <div className="flex gap-2 px-1">
                      {iv.status !== 'COMPLETED' && iv.status !== 'CANCELLED' && (
                        <>
                          <button
                            onClick={() => setRescheduleTarget(iv)}
                            className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => setFeedbackTarget(iv)}
                            className="text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => setCancelTarget(iv)}
                            className="text-xs px-2 py-1 rounded border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>

      {rescheduleTarget && (
        <RescheduleInterviewModal
          open={!!rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          interview={rescheduleTarget}
        />
      )}
      {feedbackTarget && (
        <InterviewFeedbackModal
          open={!!feedbackTarget}
          onClose={() => setFeedbackTarget(null)}
          interview={feedbackTarget}
        />
      )}
      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Interview"
        description={`Cancel the interview with ${cancelTarget?.candidateName}?`}
        confirmLabel="Cancel Interview"
        onConfirm={() => {
          if (cancelTarget) cancelInterview.mutate(cancelTarget.id, { onSuccess: () => setCancelTarget(null) });
        }}
        onCancel={() => setCancelTarget(null)}
        loading={cancelInterview.isPending}
      />
    </div>
  );
}
