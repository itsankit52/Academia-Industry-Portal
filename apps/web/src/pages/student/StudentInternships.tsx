import { useState } from 'react';
import { FiSearch, FiFilter, FiBookmark } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import InternshipCard from '@/components/cards/InternshipCard';
import MatchBadge from '@/components/ui/MatchBadge';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Button from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ApplyModal from '@/components/features/ApplyModal';
import { useInternships } from '@/hooks/queries/useInternships';
import type { InternshipWithMatch } from '@/hooks/queries/useInternships';
import { useSaved } from '@/hooks/queries/useSaved';
import { useToggleSaved } from '@/hooks/queries/useToggleSaved';

const workModeOptions = [
  { value: '', label: 'All work modes' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'ONSITE', label: 'On-site' },
];

interface Filters {
  search: string;
  workMode: string;
  location: string;
}

export default function StudentInternships() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    workMode: '',
    location: '',
  });
  const [applyInternship, setApplyInternship] = useState<InternshipWithMatch | null>(null);

  const { data, isLoading, isError, refetch } = useInternships({
    ...filters,
    status: 'PUBLISHED',
    page,
  });
  const { data: saved } = useSaved();
  const toggleSaved = useToggleSaved();

  const savedInternshipIds = new Set(saved?.internships.map((i) => i.id) ?? []);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Internships" subtitle="Browse internship opportunities with your match score." />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <aside>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 sticky top-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <FiFilter className="w-4 h-4" />
              Filters
            </div>
            <Input
              label="Search"
              placeholder="Internship title or keyword…"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{data.total}</span>{' '}
                  internship{data.total !== 1 ? 's' : ''} found
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {data.items.map((internship) => {
                  const isSaved = savedInternshipIds.has(internship.id);
                  return (
                    <div key={internship.id} className="relative group">
                      <InternshipCard internship={internship} linkPrefix="/student/internships" />
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {internship.matchScore !== undefined && (
                          <MatchBadge score={internship.matchScore} />
                        )}
                        <button
                          onClick={() =>
                            toggleSaved.mutate({
                              action: isSaved ? 'unsave' : 'save',
                              opportunityType: 'INTERNSHIP',
                              opportunityId: internship.id,
                            })
                          }
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-colors"
                          aria-label={isSaved ? 'Unsave internship' : 'Save internship'}
                        >
                          <FiBookmark
                            className={`w-4 h-4 ${isSaved ? 'fill-indigo-600 text-indigo-600' : ''}`}
                          />
                        </button>
                        <Button size="sm" onClick={() => setApplyInternship(internship)}>
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

      {applyInternship && (
        <ApplyModal
          open
          onClose={() => setApplyInternship(null)}
          opportunityType="INTERNSHIP"
          opportunityId={applyInternship.id}
          opportunityTitle={applyInternship.title}
        />
      )}
    </div>
  );
}
