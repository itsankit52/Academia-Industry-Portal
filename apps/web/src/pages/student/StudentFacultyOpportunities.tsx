/**
 * Phase 15B — Student Faculty/Institution Opportunity Discovery
 *
 * Students browse, search, and filter faculty/institution opportunities
 * that target the STUDENT role. Each card shows match score based on
 * required expertise vs the student's skill profile.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiSearch,
  FiFilter,
  FiTarget,
  FiTrendingUp,
  FiMapPin,
  FiClock,
  FiUsers,
  FiBriefcase,
  FiBookOpen,
  FiAward,
  FiFileText,
  FiCode,
} from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  useStudentFacultyOpportunities,
  useStudentFacultyApplications,
  type StudentOpportunity,
} from '@/hooks/queries/useStudentFacultyOpportunities';

const OPPORTUNITY_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'FACULTY_INTERNSHIP', label: 'Internship' },
  { value: 'FDP', label: 'FDP' },
  { value: 'CONSULTANCY', label: 'Consultancy' },
  { value: 'COLLABORATIVE_RESEARCH', label: 'Research' },
  { value: 'PROJECT', label: 'Project' },
  { value: 'APPRENTICESHIP', label: 'Apprenticeship' },
];

const HOST_TYPE_OPTIONS = [
  { value: '', label: 'All hosts' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'INSTITUTION', label: 'Institution' },
];

const MODE_OPTIONS = [
  { value: '', label: 'All modes' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'ONSITE', label: 'On-site' },
];

const typeLabel: Record<string, string> = {
  FACULTY_INTERNSHIP: 'Internship',
  FDP: 'FDP',
  CONSULTANCY: 'Consultancy',
  COLLABORATIVE_RESEARCH: 'Research',
  PROJECT: 'Project',
  APPRENTICESHIP: 'Apprenticeship',
};

const typeIcon: Record<string, React.ReactNode> = {
  FACULTY_INTERNSHIP: <FiBriefcase className="w-3.5 h-3.5" />,
  FDP: <FiBookOpen className="w-3.5 h-3.5" />,
  CONSULTANCY: <FiAward className="w-3.5 h-3.5" />,
  COLLABORATIVE_RESEARCH: <FiFileText className="w-3.5 h-3.5" />,
  PROJECT: <FiCode className="w-3.5 h-3.5" />,
  APPRENTICESHIP: <FiUsers className="w-3.5 h-3.5" />,
};

function matchScoreColor(score?: number) {
  if (score === undefined) return 'bg-slate-100 text-slate-500';
  if (score >= 75)
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (score >= 40) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
}

interface OpportunityCardProps {
  opp: StudentOpportunity;
}

function OpportunityCard({ opp }: OpportunityCardProps) {
  const deadline = new Date(opp.applicationDeadline);
  const isUrgent = deadline.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

  return (
    <Link
      to={`/student/faculty-opportunities/${opp.id}`}
      className="block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-150"
    >
      <div className="p-5 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={opp.hostType === 'COMPANY' ? 'info' : 'default'}
              size="sm"
              className="flex items-center gap-1"
            >
              {typeIcon[opp.opportunityType]}
              {typeLabel[opp.opportunityType] ?? opp.opportunityType}
            </Badge>
            {opp.hasApplied && (
              <Badge variant="success" size="sm">
                Applied
              </Badge>
            )}
          </div>
          {opp.matchScore !== undefined && (
            <span
              className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${matchScoreColor(opp.matchScore)}`}
            >
              <FiTarget className="w-3 h-3" />
              {opp.matchScore}% match
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2">
          {opp.title}
        </h3>

        {/* Host */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          {opp.hostType === 'COMPANY' ? (
            <FiBriefcase className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <FiUsers className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{opp.host.name}</span>
          <span className="ml-auto capitalize">{opp.hostType.toLowerCase()}</span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
          {opp.location && (
            <span className="flex items-center gap-1">
              <FiMapPin className="w-3.5 h-3.5 shrink-0" />
              {opp.location}
            </span>
          )}
          {opp.mode && (
            <span className="flex items-center gap-1 capitalize">{opp.mode.toLowerCase()}</span>
          )}
          {opp.durationWeeks && (
            <span className="flex items-center gap-1">
              <FiClock className="w-3.5 h-3.5 shrink-0" />
              {opp.durationWeeks}w
            </span>
          )}
          <span className="flex items-center gap-1">
            <FiUsers className="w-3.5 h-3.5 shrink-0" />
            {opp.openings} {opp.openings === 1 ? 'opening' : 'openings'}
          </span>
        </div>

        {/* Skills */}
        {opp.requiredExpertise.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {opp.requiredExpertise.slice(0, 4).map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 text-xs"
              >
                {skill}
              </span>
            ))}
            {opp.requiredExpertise.length > 4 && (
              <span className="px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
                +{opp.requiredExpertise.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Footer — deadline */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span
            className={`text-xs font-medium flex items-center gap-1 ${
              isUrgent ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <FiClock className="w-3.5 h-3.5" />
            {isUrgent ? '⏰ ' : ''}
            {formatDistanceToNow(deadline, { addSuffix: true })}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {formatDistanceToNow(new Date(opp.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function StudentFacultyOpportunities() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [opportunityType, setOpportunityType] = useState('');
  const [hostType, setHostType] = useState<'' | 'COMPANY' | 'INSTITUTION'>('');
  const [mode, setMode] = useState('');

  const [activeTab, setActiveTab] = useState<'discover' | 'my-applications'>('discover');

  const oppFilters = {
    q: search,
    opportunityType: opportunityType || undefined,
    hostType: hostType || undefined,
    mode: mode || undefined,
    page,
    pageSize: 12,
  };

  const { data, isLoading, isError, refetch } = useStudentFacultyOpportunities(oppFilters);
  const {
    data: myApps,
    isLoading: appsLoading,
    isError: appsError,
    refetch: refetchApps,
  } = useStudentFacultyApplications({ page, pageSize: 10 });

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Faculty &amp; Institution Opportunities"
        subtitle="Discover internships, FDPs, research projects, and more from academia and industry."
      />

      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => {
            setActiveTab('discover');
            setPage(1);
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'discover'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <FiTrendingUp className="w-4 h-4" />
            Discover
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab('my-applications');
            setPage(1);
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'my-applications'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          My Applications
          {myApps && myApps.total > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
              {myApps.total}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'discover' && (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input
                placeholder="Search title, skills…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                iconLeft={<FiSearch className="w-4 h-4 text-slate-400" />}
              />
              <Select
                options={OPPORTUNITY_TYPE_OPTIONS}
                value={opportunityType}
                onChange={(e) => {
                  setOpportunityType(e.target.value);
                  setPage(1);
                }}
              />
              <Select
                options={HOST_TYPE_OPTIONS}
                value={hostType}
                onChange={(e) => {
                  setHostType(e.target.value as '' | 'COMPANY' | 'INSTITUTION');
                  setPage(1);
                }}
              />
              <Select
                options={MODE_OPTIONS}
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {/* Results */}
          {isError && <ErrorState onRetry={() => void refetch()} />}

          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {data && data.items.length === 0 && !isLoading && (
            <EmptyState
              icon={<FiTarget />}
              title="No opportunities found"
              description="Try adjusting your filters or check back later."
            />
          )}

          {data && data.items.length > 0 && (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {data.total} {data.total === 1 ? 'opportunity' : 'opportunities'} found
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.items.map((opp) => (
                  <OpportunityCard key={opp.id} opp={opp} />
                ))}
              </div>
              <div className="flex justify-center">
                <Pagination
                  page={data.page}
                  totalPages={Math.ceil(data.total / data.pageSize)}
                  onChange={setPage}
                />
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'my-applications' && (
        <>
          {appsError && <ErrorState onRetry={() => void refetchApps()} />}

          {appsLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {myApps && myApps.items.length === 0 && !appsLoading && (
            <EmptyState
              icon={<FiTarget />}
              title="No applications yet"
              description="Browse opportunities and apply to get started."
              action={
                <Button onClick={() => setActiveTab('discover')}>Discover Opportunities</Button>
              }
            />
          )}

          {myApps && myApps.items.length > 0 && (
            <>
              <div className="space-y-3">
                {myApps.items.map((app) => (
                  <Link
                    key={app.id}
                    to={`/student/faculty-opportunities/${app.opportunity?.id}`}
                    className="block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {app.opportunity?.title ?? '—'}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {app.opportunity?.hostName ?? '—'} ·{' '}
                          {typeLabel[app.opportunity?.type ?? ''] ?? app.opportunity?.type}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          Applied{' '}
                          {formatDistanceToNow(new Date(app.appliedAt), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Badge
                          variant={
                            app.status === 'APPLIED'
                              ? 'info'
                              : app.status === 'WITHDRAWN'
                                ? 'danger'
                                : app.status === 'REJECTED'
                                  ? 'danger'
                                  : app.status === 'SHORTLISTED'
                                    ? 'warning'
                                    : app.status === 'SELECTED'
                                      ? 'success'
                                      : 'default'
                          }
                          size="sm"
                        >
                          {app.status.replace(/_/g, ' ')}
                        </Badge>
                        {app.matchScore !== undefined && (
                          <span
                            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${matchScoreColor(app.matchScore)}`}
                          >
                            {app.matchScore}%
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {myApps.totalPages > 1 && (
                <div className="flex justify-center">
                  <Pagination
                    page={myApps.page}
                    totalPages={myApps.totalPages}
                    onChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
