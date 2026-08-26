import PageHeader from '@/components/ui/PageHeader';
import ErrorState from '@/components/ui/ErrorState';
import { useThemeStore } from '@/store/theme';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  useAdminDashboardStats,
  useAdminAnalyticsPlacements,
} from '@/hooks/queries/useAdminAnalytics';

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

export default function AdminAnalytics() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const axisColor = isDark ? '#64748b' : '#94a3b8';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } =
    useAdminDashboardStats();
  const { data: placements = [], isLoading: placementsLoading, isError: placementsError, refetch: refetchPlacements } =
    useAdminAnalyticsPlacements();

  if (statsError || placementsError) {
    return (
      <ErrorState
        onRetry={() => {
          refetchStats();
          refetchPlacements();
        }}
      />
    );
  }

  const skillsData = stats?.skillDemand ?? [];

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Analytics" subtitle="Placement rates, trends, and performance insights." />

      <ChartCard title="Applications Over Time">
        {statsLoading ? (
          <ChartSkeleton />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats?.applicationsOverTime ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                name="Applications"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Placements Over Time">
        {statsLoading ? (
          <ChartSkeleton />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats?.placementsOverTime ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} />
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

      <ChartCard title="Top Skills in Demand">
        {statsLoading ? (
          <ChartSkeleton />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={skillsData.slice(0, 15)} margin={{ bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="skill"
                tick={{ fontSize: 11, fill: axisColor }}
                angle={-40}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" name="Job Listings" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Placement Rate by Branch">
        {placementsLoading ? (
          <ChartSkeleton />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={placements}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="branch" tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} unit="%" domain={[0, 100]} />
              <Tooltip formatter={(value: number) => `${Number(value).toFixed(2)}%`} />
              <Bar dataKey="placementRate" fill="#10b981" name="Placement Rate (%)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
