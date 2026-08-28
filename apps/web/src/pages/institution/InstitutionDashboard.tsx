import { useState } from 'react';
import {
  FiUsers,
  FiUser,
  FiClipboard,
  FiAward,
  FiCalendar,
  FiBarChart2,
  FiFilter,
  FiTrendingUp,
  FiActivity,
  FiBriefcase,
  FiCheckCircle,
  FiStar,
} from 'react-icons/fi';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useThemeStore } from '@/store/theme';
import {
  useInstitutionStats,
  useInstitutionPlacements,
  useInstitutionSkillGaps,
  type InstitutionStatsFilters,
} from '@/hooks/queries/useInstitutionAnalytics';

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-[300px] animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg" />;
}

const OPPORTUNITY_TYPES = [
  'JOB',
  'INTERNSHIP',
  'PROJECT',
  'APPRENTICESHIP',
  'FACULTY_INTERNSHIP',
  'FDP',
  'CONSULTANCY',
  'COLLABORATIVE_RESEARCH',
];
const APPLICATION_STATUSES = [
  'APPLIED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'SELECTED',
  'REJECTED',
  'WITHDRAWN',
];

export default function InstitutionDashboard() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const axisColor = isDark ? '#64748b' : '#94a3b8';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  const [filters, setFilters] = useState<InstitutionStatsFilters>({});

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useInstitutionStats(filters);
  const {
    data: placements,
    isLoading: placementsLoading,
    isError: placementsError,
    refetch: refetchPlacements,
  } = useInstitutionPlacements();
  const {
    data: skillGaps,
    isLoading: skillGapsLoading,
    isError: skillGapsError,
    refetch: refetchSkillGaps,
  } = useInstitutionSkillGaps();

  if (statsError || placementsError || skillGapsError) {
    return (
      <ErrorState
        onRetry={() => {
          refetchStats();
          refetchPlacements();
          refetchSkillGaps();
        }}
      />
    );
  }

  const statusData = (placements?.byStatus ?? []).map((s) => ({ name: s.status, value: s.count }));
  const skillGapData = (skillGaps ?? [])
    .slice(0, 10)
    .map((s) => ({ name: s.name, count: s.missingCount }));

  const deptPlacementData = (stats?.departmentWisePlacement ?? []).map((d) => ({
    department: d.department.length > 12 ? d.department.slice(0, 12) + '…' : d.department,
    placed: d.placedCount,
    total: d.totalCount,
    rate: d.rate,
  }));

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Institution Dashboard"
        subtitle="Comprehensive overview of student performance, placements, skill trends, and institutional metrics."
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <FiFilter className="w-4 h-4" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        <input
          type="text"
          placeholder="Department (branch)"
          className="input input-sm w-44"
          value={filters.department ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value || undefined }))}
        />
        <input
          type="date"
          className="input input-sm w-36"
          value={filters.fromDate ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value || undefined }))}
        />
        <input
          type="date"
          className="input input-sm w-36"
          value={filters.toDate ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value || undefined }))}
        />
        <select
          className="select select-sm w-44"
          value={filters.opportunityType ?? ''}
          onChange={(e) =>
            setFilters((f) => ({ ...f, opportunityType: e.target.value || undefined }))
          }
        >
          <option value="">All Opportunity Types</option>
          {OPPORTUNITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select
          className="select select-sm w-44"
          value={filters.applicationStatus ?? ''}
          onChange={(e) =>
            setFilters((f) => ({ ...f, applicationStatus: e.target.value || undefined }))
          }
        >
          <option value="">All Application Statuses</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        {(filters.department ||
          filters.fromDate ||
          filters.toDate ||
          filters.opportunityType ||
          filters.applicationStatus) && (
          <button
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            onClick={() => setFilters({})}
          >
            Clear
          </button>
        )}
      </div>

      {/* Primary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard label="Total Students" value={stats?.studentCount ?? 0} icon={<FiUsers />} />
            <StatCard
              label="Active Students"
              value={stats?.activeStudents ?? 0}
              icon={<FiActivity />}
            />
            <StatCard
              label="Active Applications"
              value={stats?.activeApplicationsCount ?? 0}
              icon={<FiClipboard />}
            />
            <StatCard label="Placements" value={stats?.placementsCount ?? 0} icon={<FiAward />} />
            <StatCard
              label="Interviews Scheduled"
              value={stats?.interviewsScheduledCount ?? 0}
              icon={<FiCalendar />}
            />
            <StatCard
              label="Avg Match Score"
              value={stats?.avgMatchScore ? `${stats.avgMatchScore}%` : '—'}
              icon={<FiBarChart2 />}
            />
          </>
        )}
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3">
        {statsLoading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              label="Assessment Complete"
              value={stats?.assessmentCompletionCount ?? 0}
              icon={<FiCheckCircle />}
            />
            <StatCard
              label="Assmnt Rate"
              value={stats?.assessmentCompletionRate ? `${stats.assessmentCompletionRate}%` : '—'}
              icon={<FiTrendingUp />}
            />
            <StatCard
              label="Skill Developed"
              value={stats?.skillDevelopmentCount ?? 0}
              icon={<FiStar />}
            />
            <StatCard
              label="Skill Rate"
              value={stats?.skillDevelopmentRate ? `${stats.skillDevelopmentRate}%` : '—'}
              icon={<FiTrendingUp />}
            />
            <StatCard
              label="Internship Apps"
              value={stats?.internshipApplicationsCount ?? 0}
              icon={<FiBriefcase />}
            />
            <StatCard
              label="Job Apps"
              value={stats?.jobApplicationsCount ?? 0}
              icon={<FiBriefcase />}
            />
            <StatCard
              label="Shortlisted"
              value={stats?.shortlistedStudentsCount ?? 0}
              icon={<FiCheckCircle />}
            />
            <StatCard
              label="Placement %"
              value={stats?.placementPercentage ? `${stats.placementPercentage}%` : '—'}
              icon={<FiAward />}
            />
          </>
        )}
      </div>

      {/* Third Stats Row — Companies & Opportunities */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard label="Faculty" value={stats?.facultyCount ?? 0} icon={<FiUser />} />
            <StatCard
              label="Active Companies"
              value={stats?.activeCompaniesCount ?? 0}
              icon={<FiBriefcase />}
            />
            <StatCard
              label="Published Jobs"
              value={stats?.publishedJobsCount ?? 0}
              icon={<FiBriefcase />}
            />
            <StatCard
              label="Published Internships"
              value={stats?.publishedInternshipsCount ?? 0}
              icon={<FiBriefcase />}
            />
          </>
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Applications by Status">
          {placementsLoading ? (
            <ChartSkeleton />
          ) : statusData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              No application data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Placements Over Last 12 Months">
          {placementsLoading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={placements?.byMonth ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Placements"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Department-wise Placement Rate">
          {statsLoading ? (
            <ChartSkeleton />
          ) : deptPlacementData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              No placement data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deptPlacementData} margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="department" tick={{ fontSize: 11, fill: axisColor }} />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="placed" fill="#10b981" name="Placed" />
                <Bar dataKey="total" fill="#6366f1" name="Total" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top 10 Skill Gaps (Students Missing Required Skills)">
          {skillGapsLoading ? (
            <ChartSkeleton />
          ) : skillGapData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              No skill gap data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart layout="vertical" data={skillGapData} margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={130}
                  tick={{ fontSize: 11, fill: axisColor }}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" name="Students Missing" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Most Demanded Skills (Job + Internship)">
          {statsLoading ? (
            <ChartSkeleton />
          ) : !stats?.mostDemandedSkills?.length ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              No skill demand data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={stats.mostDemandedSkills
                  .slice(0, 10)
                  .map((s) => ({ name: s.name, count: s.count }))}
                margin={{ left: 16, right: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: axisColor }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" name="Demand Count" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Industry Skill Demand Distribution">
          {statsLoading ? (
            <ChartSkeleton />
          ) : !stats?.industrySkillDemand?.length ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              No industry skill demand data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={stats.industrySkillDemand.slice(0, 10).map((s) => ({
                  name: s.name,
                  percentage: s.percentage,
                }))}
                margin={{ left: 16, right: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: axisColor }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} unit="%" />
                <Tooltip formatter={(val: number) => [`${val}%`, 'Demand %']} />
                <Bar dataKey="percentage" fill="#06b6d4" name="Demand %" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
