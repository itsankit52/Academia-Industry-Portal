import { useState } from 'react';
import { FiUsers } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import CandidateCard from '@/components/cards/CandidateCard';
import ScheduleInterviewModal from '@/components/features/ScheduleInterviewModal';
import { useCompanyApplicants, useUpdateApplicationStatus } from '@/hooks/queries/useCompanyApplicants';
import type { Application } from '@aip/types';

export default function CompanyShortlisted() {
  const { data, isLoading, isError, refetch } = useCompanyApplicants({ status: 'SHORTLISTED' });
  const applications = data?.items ?? [];
  const updateStatus = useUpdateApplicationStatus();
  const [scheduleTarget, setScheduleTarget] = useState<Application | null>(null);

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Shortlisted"
        subtitle={`${applications.length} candidate${applications.length !== 1 ? 's' : ''} shortlisted.`}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : applications.length === 0 ? (
        <EmptyState
          icon={<FiUsers />}
          title="No shortlisted candidates"
          description="Shortlist candidates from the Applicants page."
        />
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <div key={app.id} className="flex items-center gap-3">
              <div className="flex-1">
                <CandidateCard application={app} />
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setScheduleTarget(app)}
                   className="text-xs px-2.5 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-medium transition-colors"
                >
                  Schedule Interview
                </button>
                <button
                  onClick={() => updateStatus.mutate({ id: app.id, status: 'INTERVIEW_SCHEDULED' })}
                   className="text-xs px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 font-medium transition-colors"
                  disabled={updateStatus.isPending}
                >
                  Move to Interview
                </button>
                <button
                  onClick={() => updateStatus.mutate({ id: app.id, status: 'REJECTED' })}
                   className="text-xs px-2.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium transition-colors"
                  disabled={updateStatus.isPending}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {scheduleTarget && (
        <ScheduleInterviewModal
          open={!!scheduleTarget}
          onClose={() => setScheduleTarget(null)}
          applicationId={scheduleTarget.id}
        />
      )}
    </div>
  );
}
