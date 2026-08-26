import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiSearch, FiFilter } from 'react-icons/fi';
import type { Paginated, Internship } from '@aip/types';
import { apiGet } from '@/lib/api';
import InternshipCard from '@/components/cards/InternshipCard';
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

const durationOptions = [
  { value: '', label: 'Any duration' },
  { value: '1', label: '1 month' },
  { value: '2', label: '2 months' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
];

interface Filters {
  search: string;
  workMode: string;
  duration: string;
  location: string;
}

export default function PublicInternships() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    workMode: '',
    duration: '',
    location: '',
  });

  const params = new URLSearchParams({ status: 'PUBLISHED', page: String(page), pageSize: '12' });
  if (filters.workMode) params.set('workMode', filters.workMode);
  if (filters.duration) params.set('durationMonths', filters.duration);
  if (filters.location) params.set('location', filters.location);
  if (filters.search) params.set('search', filters.search);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-internships', page, filters],
    queryFn: () => apiGet<Paginated<Internship>>(`/internships?${params.toString()}`),
  });

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  return (
    <div className="container-page py-10">
      <PageHeader
        title="Internships"
        subtitle="Browse paid and unpaid internships from companies actively seeking students."
        className="mb-8"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <aside className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <FiFilter className="w-4 h-4" />
              Filters
            </div>
            <Input
              label="Search"
              placeholder="Role or keyword…"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
            />
            <Select
              label="Work mode"
              options={workModeOptions}
              value={filters.workMode}
              onChange={(e) => setFilter('workMode', e.target.value)}
            />
            <Select
              label="Duration"
              options={durationOptions}
              value={filters.duration}
              onChange={(e) => setFilter('duration', e.target.value)}
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
          {isError && <ErrorState onRetry={() => void refetch()} />}

          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {data && data.items.length === 0 && !isLoading && (
            <EmptyState
              title="No internships found"
              description="Try adjusting your filters or check back later."
              icon={<FiSearch />}
            />
          )}

          {data && data.items.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{data.total}</span> internship{data.total !== 1 ? 's' : ''} found
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {data.items.map((internship) => (
                  <InternshipCard key={internship.id} internship={internship} />
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
