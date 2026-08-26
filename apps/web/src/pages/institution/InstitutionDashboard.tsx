import { FiUsers, FiUser, FiClipboard, FiAward, FiCalendar, FiBarChart2 } from 'react-icons/fi';
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
import { useInstitutionStats, useInstitutionPlacements, useInstitutionSkillGaps } from '@/hooks/queries/useInstitutionAnalytics';

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

export default function InstitutionDashboard() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const axisColor = isDark ? '#64748b' : '#94a3b8';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useInstitutionStats();

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
  const skillGapData = (skillGaps ?? []).slice(0, 10).map((s) => ({ name: s.name, count: s.missingCount }));

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Institution Dashboard"
        subtitle="Overview of student performance, placements, and skill trends."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard label="Students" value={stats?.studentCount ?? 0} icon={<FiUsers />} />
            <StatCard label="Faculty" value={stats?.facultyCount ?? 0} icon={<FiUser />} />
            <StatCard label="Active Applications" value={stats?.activeApplicationsCount ?? 0} icon={<FiClipboard />} />
            <StatCard label="Placements" value={stats?.placementsCount ?? 0} icon={<FiAward />} />
            <StatCard label="Interviews Scheduled" value={stats?.interviewsScheduledCount ?? 0} icon={<FiCalendar />} />
            <StatCard
              label="Avg Match Score"
              value={stats?.avgMatchScore ? `${stats.avgMatchScore}%` : '—'}
              icon={<FiBarChart2 />}
            />
          </>
        )}
      </div>

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
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
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
              <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" name="Students Missing" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
