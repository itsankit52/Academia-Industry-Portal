import { FiBookOpen } from 'react-icons/fi';
import {
  ResponsiveContainer,
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
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useThemeStore } from '@/store/theme';
import { useInstitutionFdps } from '@/hooks/queries/useInstitutionAnalytics';

function ChartSkeleton() {
  return <div className="h-[300px] animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg" />;
}

export default function InstitutionFdps() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const axisColor = isDark ? '#64748b' : '#94a3b8';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  const { data: fdps, isLoading, isError, refetch } = useInstitutionFdps();

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Faculty Development Programmes"
        subtitle="FDP participation statistics across your institution."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard label="Total Faculty" value={fdps?.totalFaculty ?? 0} icon={<FiBookOpen />} />
            <StatCard label="Applied to FDPs" value={fdps?.appliedToFdps ?? 0} icon={<FiBookOpen />} />
            <StatCard label="Accepted" value={fdps?.acceptedToFdps ?? 0} icon={<FiBookOpen />} />
            <StatCard label="Completed" value={fdps?.completedFdps ?? 0} icon={<FiBookOpen />} />
          </>
        )}
      </div>

      {!isLoading && (fdps?.appliedToFdps ?? 0) === 0 ? (
        <EmptyState
          icon={<FiBookOpen />}
          title="No FDP applications yet"
          description="FDP participation data will appear here once faculty apply to Faculty Development Programmes."
        />
      ) : (
        <>
          {(fdps?.byFacultyDept ?? []).length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
                FDP Participation by Department
              </h3>
              {isLoading ? (
                <ChartSkeleton />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={fdps?.byFacultyDept ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="department" tick={{ fontSize: 11, fill: axisColor }} />
                    <YAxis tick={{ fontSize: 11, fill: axisColor }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="applied" fill="#6366f1" name="Applied" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="accepted" fill="#10b981" name="Accepted" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" fill="#f59e0b" name="Completed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Department Summary
            </h3>
            <Table>
              <Table.Head>
                <tr>
                  <Table.Th>Department</Table.Th>
                  <Table.Th>Applied</Table.Th>
                  <Table.Th>Accepted</Table.Th>
                  <Table.Th>Completed</Table.Th>
                </tr>
              </Table.Head>
              <Table.Body>
                {(fdps?.byFacultyDept ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState icon={<FiBookOpen />} title="No department data available." />
                    </td>
                  </tr>
                ) : (
                  (fdps?.byFacultyDept ?? []).map((row) => (
                    <tr key={row.department}>
                      <Table.Td className="font-medium text-slate-900 dark:text-slate-100">
                        {row.department}
                      </Table.Td>
                      <Table.Td>{row.applied}</Table.Td>
                      <Table.Td>{row.accepted}</Table.Td>
                      <Table.Td>{row.completed}</Table.Td>
                    </tr>
                  ))
                )}
              </Table.Body>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
