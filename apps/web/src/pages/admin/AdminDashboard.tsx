import { FiUsers, FiBriefcase, FiBook, FiFileText, FiTrendingUp } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAdminDashboardStats } from '@/hooks/queries/useAdminAnalytics';

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminDashboard() {
  const { data, isLoading, isError, refetch } = useAdminDashboardStats();

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Admin Dashboard" subtitle="Placement cell overview and key metrics." />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard label="Total Students" value={data?.totalStudents ?? 0} icon={<FiUsers className="w-5 h-5" />} />
            <StatCard label="Total Companies" value={data?.totalCompanies ?? 0} icon={<FiBriefcase className="w-5 h-5" />} />
            <StatCard label="Total Jobs" value={data?.totalJobs ?? 0} icon={<FiBriefcase className="w-5 h-5" />} />
            <StatCard label="Total Internships" value={data?.totalInternships ?? 0} icon={<FiBook className="w-5 h-5" />} />
            <StatCard label="Total Applications" value={data?.totalApplications ?? 0} icon={<FiFileText className="w-5 h-5" />} />
            <StatCard label="Placement Rate" value={`${Number(data?.placementRate ?? 0).toFixed(2)}%`} icon={<FiTrendingUp className="w-5 h-5" />} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Applications Over Time</h3>
              <Link to="/admin/analytics" className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">Full Analytics →</Link>
            </div>
          </Card.Header>
          <Card.Body>
            {isLoading ? (
              <div className="h-64 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data?.applicationsOverTime ?? []}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} name="Applications" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Jobs by Category</h3></Card.Header>
          <Card.Body>
            {isLoading ? (
              <div className="h-64 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={data?.jobsByCategory ?? []} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={80}>
                    {(data?.jobsByCategory ?? []).map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
