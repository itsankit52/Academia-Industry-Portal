import { useState } from 'react';
import { FiSearch, FiFilter, FiBookmark, FiBookmark as FiBookmarkFill } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import JobCard from '@/components/cards/JobCard';
import MatchBadge from '@/components/ui/MatchBadge';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Button from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ApplyModal from '@/components/features/ApplyModal';
import { useJobs } from '@/hooks/queries/useJobs';
import type { JobWithMatch } from '@/hooks/queries/useJobs';
import { useSaved } from '@/hooks/queries/useSaved';
import { useToggleSaved } from '@/hooks/queries/useToggleSaved';

const workModeOptions = [
  { value: '', label: 'All work modes' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'ONSITE', label: 'On-site' },
];

const employmentTypeOptions = [
  { value: '', label: 'All types' },
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
];

interface Filters {
  search: string;
  workMode: string;
  employmentType: string;
  location: string;
  minSalary: string;
}

export default function StudentJobs() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    workMode: '',
    employmentType: '',
    location: '',
    minSalary: '',
  });
  const [applyJob, setApplyJob] = useState<JobWithMatch | null>(null);

  const { data, isLoading, isError, refetch } = useJobs({
    ...filters,
    status: 'PUBLISHED',
    page,
  });
  const { data: saved } = useSaved();
  const toggleSaved = useToggleSaved();

  const savedJobIds = new Set(saved?.jobs.map((j) => j.id) ?? []);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Jobs" subtitle="Browse all available job listings with your match score." />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <aside>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 sticky top-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <FiFilter className="w-4 h-4" />
              Filters
            </div>
            <Input
              label="Search"
              placeholder="Job title or keyword…"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              iconLeft={<FiSearch className="w-4 h-4 text-slate-400" />}
            />
            <Select
              label="Work mode"
              options={workModeOptions}
              value={filters.workMode}
              onChange={(e) => setFilter('workMode', e.target.value)}
            />
            <Select
              label="Employment type"
              options={employmentTypeOptions}
              value={filters.employmentType}
              onChange={(e) => setFilter('employmentType', e.target.value)}
            />
            <Input
              label="Location"
              placeholder="City or state…"
              value={filters.location}
              onChange={(e) => setFilter('location', e.target.value)}
            />
            <Input
              label="Min. Salary (₹)"
              type="number"
              placeholder="500000"
              value={filters.minSalary}
              onChange={(e) => setFilter('minSalary', e.target.value)}
            />
          </div>
        </aside>

        <div>
          {isError && <ErrorState onRetry={() => void refetch()} />}

          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {data && data.items.length === 0 && !isLoading && (
            <EmptyState
              title="No jobs found"
              description="Try adjusting your filters or check back later."
              icon={<FiSearch />}
            />
          )}

          {data && data.items.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{data.total}</span> job{data.total !== 1 ? 's' : ''} found
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {data.items.map((job) => {
                  const isSaved = savedJobIds.has(job.id);
                  return (
                    <div key={job.id} className="relative group">
                      <JobCard job={job} linkPrefix="/student/jobs" />
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {job.matchScore !== undefined && (
                          <MatchBadge score={job.matchScore} />
                        )}
                        <button
                          onClick={() =>
                            toggleSaved.mutate({
                              action: isSaved ? 'unsave' : 'save',
                              opportunityType: 'JOB',
                              opportunityId: job.id,
                            })
                          }
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-colors"
                          aria-label={isSaved ? 'Unsave job' : 'Save job'}
                        >
                          {isSaved ? (
                            <FiBookmarkFill className="w-4 h-4 fill-indigo-600 text-indigo-600" />
                          ) : (
                            <FiBookmark className="w-4 h-4" />
                          )}
                        </button>
                        <Button
                          size="sm"
                          onClick={() => setApplyJob(job)}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center">
                <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
              </div>
            </>
          )}
        </div>
      </div>

      {applyJob && (
        <ApplyModal
          open
          onClose={() => setApplyJob(null)}
          opportunityType="JOB"
          opportunityId={applyJob.id}
          opportunityTitle={applyJob.title}
        />
      )}
    </div>
  );
}
