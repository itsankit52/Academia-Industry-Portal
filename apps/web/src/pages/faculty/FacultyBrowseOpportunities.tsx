import { useState } from 'react';
import { FiFilter, FiSearch } from 'react-icons/fi';
import { WORK_MODES } from '@aip/config';
import type { FacultyOpportunity } from '@aip/types';
import PageHeader from '@/components/ui/PageHeader';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Button from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import FacultyOpportunityCard from '@/components/cards/FacultyOpportunityCard';
import ApplyModal from '@/components/features/ApplyModal';
import { useFacultyOpportunities } from '@/hooks/queries/useFacultyOpportunities';

const typeOptions = [
  { value: 'FACULTY_INTERNSHIP', label: 'Faculty Internship' },
  { value: 'FDP', label: 'Faculty Dev Program' },
  { value: 'CONSULTANCY', label: 'Consultancy' },
  { value: 'COLLABORATIVE_RESEARCH', label: 'Collaborative Research' },
];

const modeOptions = [
  { value: '', label: 'All modes' },
  ...WORK_MODES.map((m) => ({ value: m, label: m.charAt(0) + m.slice(1).toLowerCase() })),
];

const hostTypeOptions = [
  { value: '', label: 'All hosts' },
  { value: 'COMPANY', label: 'Industry' },
  { value: 'INSTITUTION', label: 'Institution' },
];

interface Filters {
  q: string;
  opportunityType: string;
  mode: string;
  hostType: string;
}

export default function FacultyBrowseOpportunities() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    q: '',
    opportunityType: '',
    mode: '',
    hostType: '',
  });
  const [applyOpp, setApplyOpp] = useState<FacultyOpportunity | null>(null);

  const { data, isLoading, isError, refetch } = useFacultyOpportunities({
    ...filters,
    opportunityType: filters.opportunityType || undefined,
    mode: filters.mode || undefined,
    hostType: filters.hostType || undefined,
    q: filters.q || undefined,
    page,
  });

  function toggleType(value: string) {
    setFilters((prev) => ({ ...prev, opportunityType: prev.opportunityType === value ? '' : value }));
    setPage(1);
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Browse Opportunities"
        subtitle="Faculty programs, consultancy, FDPs and collaborative research."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <aside>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 sticky top-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <FiFilter className="w-4 h-4" />
              Filters
            </div>

            <Input
              label="Keyword"
              placeholder="Search title or description…"
              value={filters.q}
              onChange={(e) => setFilter('q', e.target.value)}
              iconLeft={<FiSearch className="w-4 h-4 text-slate-400" />}
            />

            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                Opportunity Type
              </p>
              <div className="space-y-1.5">
                {typeOptions.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.opportunityType === opt.value}
                      onChange={() => toggleType(opt.value)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Select
              label="Work mode"
              options={modeOptions}
              value={filters.mode}
              onChange={(e) => setFilter('mode', e.target.value)}
            />

            <Select
              label="Host type"
              options={hostTypeOptions}
              value={filters.hostType}
              onChange={(e) => setFilter('hostType', e.target.value)}
            />
          </div>
        </aside>

        <div>
          {isError && <ErrorState onRetry={() => void refetch()} />}

          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {data && data.items.length === 0 && !isLoading && (
            <EmptyState
              title="No opportunities found"
              description="Try adjusting your filters or check back later."
              icon={<FiSearch />}
            />
          )}

          {data && data.items.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{data.total}</span>{' '}
                  opportunit{data.total !== 1 ? 'ies' : 'y'} found
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {data.items.map((opp) => {
                  const canApply = opp.targetRoles.includes('FACULTY');
                  return (
                    <div key={opp.id} className="relative group">
                      <FacultyOpportunityCard opportunity={opp} />
                      {canApply && (
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" onClick={() => setApplyOpp(opp)}>
                            Apply
                          </Button>
                        </div>
                      )}
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

      {applyOpp && (
        <ApplyModal
          open
          onClose={() => setApplyOpp(null)}
          opportunityType={applyOpp.opportunityType}
          opportunityId={applyOpp.id}
          opportunityTitle={applyOpp.title}
        />
      )}
    </div>
  );
}
