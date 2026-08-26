import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiSearch, FiFilter } from 'react-icons/fi';
import type { Paginated, Job } from '@aip/types';
import { apiGet } from '@/lib/api';
import JobCard from '@/components/cards/JobCard';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import PageHeader from '@/components/ui/PageHeader';

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
}

export default function PublicJobs() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    workMode: '',
    employmentType: '',
    location: '',
  });

  const params = new URLSearchParams({ status: 'PUBLISHED', page: String(page), pageSize: '12' });
  if (filters.workMode) params.set('workMode', filters.workMode);
  if (filters.employmentType) params.set('employmentType', filters.employmentType);
  if (filters.location) params.set('location', filters.location);
  if (filters.search) params.set('search', filters.search);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-jobs', page, filters],
    queryFn: () => apiGet<Paginated<Job>>(`/jobs?${params.toString()}`),
  });

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  return (
    <div className="container-page py-10">
      <PageHeader
        title="Jobs"
        subtitle="Discover full-time, part-time, and contract opportunities from leading companies."
        className="mb-8"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <aside className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 dark:bg-slate-900 dark:border-slate-800">
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
          </div>
        </aside>

        <div>
          {isError && (
            <ErrorState onRetry={() => void refetch()} />
          )}

          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {data && data.items.length === 0 && !isLoading && (
            <EmptyState
              title="No jobs found"
              description="Try adjusting your filters or check back later for new listings."
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {data.items.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
              <div className="flex justify-center">
                <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
