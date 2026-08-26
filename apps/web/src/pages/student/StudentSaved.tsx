import { useState } from 'react';
import { FiBookmark } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import JobCard from '@/components/cards/JobCard';
import InternshipCard from '@/components/cards/InternshipCard';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ApplyModal from '@/components/features/ApplyModal';
import { useSaved } from '@/hooks/queries/useSaved';
import { useToggleSaved } from '@/hooks/queries/useToggleSaved';
import type { Job, Internship } from '@aip/types';

export default function StudentSaved() {
  const [tab, setTab] = useState('jobs');
  const { data, isLoading, isError, refetch } = useSaved();
  const toggleSaved = useToggleSaved();
  const [applyTarget, setApplyTarget] = useState<{ type: 'JOB' | 'INTERNSHIP'; item: Job | Internship } | null>(null);

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Saved" subtitle="Your bookmarked jobs and internships." />

      {isError && <ErrorState onRetry={() => void refetch()} />}

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="jobs" label={`Jobs${data ? ` (${data.jobs.length})` : ''}`} />
          <Tabs.Tab value="internships" label={`Internships${data ? ` (${data.internships.length})` : ''}`} />
        </Tabs.List>

        <Tabs.Panels className="mt-6">
          <Tabs.Panel value="jobs">
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            )}
            {data && data.jobs.length === 0 && (
              <EmptyState
                icon={<FiBookmark />}
                title="No saved jobs"
                description="Bookmark jobs from the Jobs page to see them here."
              />
            )}
            {data && data.jobs.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.jobs.map((job) => (
                  <div key={job.id} className="relative">
                    <JobCard job={job} linkPrefix="/student/jobs" />
                    <div className="absolute top-3 right-3 flex gap-1.5">
                      <Button size="sm" onClick={() => setApplyTarget({ type: 'JOB', item: job })}>
                        Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleSaved.mutate({
                            action: 'unsave',
                            opportunityType: 'JOB',
                            opportunityId: job.id,
                          })
                        }
                      >
                        Unsave
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="internships">
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            )}
            {data && data.internships.length === 0 && (
              <EmptyState
                icon={<FiBookmark />}
                title="No saved internships"
                description="Bookmark internships from the Internships page to see them here."
              />
            )}
            {data && data.internships.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.internships.map((internship) => (
                  <div key={internship.id} className="relative">
                    <InternshipCard internship={internship} linkPrefix="/student/internships" />
                    <div className="absolute top-3 right-3 flex gap-1.5">
                      <Button size="sm" onClick={() => setApplyTarget({ type: 'INTERNSHIP', item: internship })}>
                        Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleSaved.mutate({
                            action: 'unsave',
                            opportunityType: 'INTERNSHIP',
                            opportunityId: internship.id,
                          })
                        }
                      >
                        Unsave
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>

      {applyTarget && (
        <ApplyModal
          open
          onClose={() => setApplyTarget(null)}
          opportunityType={applyTarget.type}
          opportunityId={applyTarget.item.id}
          opportunityTitle={applyTarget.item.title}
        />
      )}
    </div>
  );
}
