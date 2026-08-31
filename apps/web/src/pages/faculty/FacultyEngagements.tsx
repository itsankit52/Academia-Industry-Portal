import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBriefcase, FiCalendar } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useFacultyEngagements } from '@/hooks/queries/useFacultyEngagements';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'default' },
  ONGOING: { label: 'Ongoing', variant: 'success' },
  PAUSED: { label: 'Paused', variant: 'warning' },
  TERMINATED: { label: 'Terminated', variant: 'danger' },
  PENDING: { label: 'Pending', variant: 'info' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  SUSPENDED: { label: 'Suspended', variant: 'warning' },
};

type Tab = 'ALL' | 'ACTIVE' | 'COMPLETED';

export default function FacultyEngagements() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('ALL');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useFacultyEngagements({
    tab,
    page,
    pageSize: 12,
  });

  const engagements = data?.items ?? [];

  const totalApplications = data?.total ?? 0;
  const activeCount = engagements.filter(
    (e) => e.status === 'ACTIVE' || e.status === 'ONGOING',
  ).length;
  const completedCount = engagements.filter((e) => e.status === 'COMPLETED').length;

  const tabs: { value: Tab; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'COMPLETED', label: 'Completed' },
  ];

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="My Industry Engagements"
        subtitle="Track and manage your faculty-industry collaboration engagements."
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setTab(t.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === t.value
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 dark:bg-slate-900 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Engagements</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isLoading ? (
              <span className="inline-block w-12 h-7 animate-pulse bg-slate-200 rounded dark:bg-slate-800" />
            ) : (
              totalApplications
            )}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 dark:bg-slate-900 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">Active Engagements</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {isLoading ? (
              <span className="inline-block w-12 h-7 animate-pulse bg-slate-200 rounded dark:bg-slate-800" />
            ) : (
              activeCount
            )}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 dark:bg-slate-900 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">Completed Engagements</p>
          <p className="mt-1 text-2xl font-bold text-slate-600 dark:text-slate-300">
            {isLoading ? (
              <span className="inline-block w-12 h-7 animate-pulse bg-slate-200 rounded dark:bg-slate-800" />
            ) : (
              completedCount
            )}
          </p>
        </div>
      </div>

      {/* Error State */}
      {isError && <ErrorState onRetry={() => void refetch()} />}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Engagement Cards Grid */}
      {!isLoading && !isError && engagements.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {engagements.map((engagement) => {
            const cfg = statusConfig[engagement.status] ?? {
              label: engagement.status,
              variant: 'default' as BadgeVariant,
            };
            return (
              <div
                key={engagement.id}
                onClick={() => navigate(`/faculty/applications/${engagement.id}`)}
                className="cursor-pointer hover:shadow-md transition-shadow rounded-xl"
              >
                <Card>
                  <Card.Body className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2">
                        {engagement.facultyOpportunityTitle}
                      </h3>
                      <Badge variant={cfg.variant} size="sm">
                        {cfg.label}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {engagement.institutionName}
                    </p>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <FiCalendar className="w-3.5 h-3.5 shrink-0" />
                      {engagement.startDate && engagement.endDate ? (
                        <span>
                          {format(new Date(engagement.startDate), 'MMM d, yyyy')} &ndash;{' '}
                          {format(new Date(engagement.endDate), 'MMM d, yyyy')}
                        </span>
                      ) : engagement.startDate ? (
                        <span>Started {format(new Date(engagement.startDate), 'MMM d, yyyy')}</span>
                      ) : (
                        <span>Timeline not set</span>
                      )}
                    </div>

                    {engagement.outcome && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                        {engagement.outcome}
                      </p>
                    )}
                  </Card.Body>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && engagements.length === 0 && (
        <EmptyState
          icon={<FiBriefcase />}
          title="No engagements found"
          description="Your faculty-industry collaborations will appear here once created."
        />
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
