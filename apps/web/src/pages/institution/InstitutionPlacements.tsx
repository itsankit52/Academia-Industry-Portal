import { FiAward } from 'react-icons/fi';
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
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { useThemeStore } from '@/store/theme';
import { useInstitutionPlacements } from '@/hooks/queries/useInstitutionAnalytics';

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

export default function InstitutionPlacements() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const axisColor = isDark ? '#64748b' : '#94a3b8';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  const { data: placements, isLoading, isError, refetch } = useInstitutionPlacements();

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Placements"
        subtitle="Placement trends, branch-wise rates, and overall statistics."
      />

      <ChartCard title="Placements Over Last 12 Months">
        {isLoading ? (
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
                dot={{ r: 4, fill: '#10b981' }}
                name="Placements"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Placement Rate by Branch">
        {isLoading ? (
          <ChartSkeleton />
        ) : (placements?.byBranch ?? []).length === 0 ? (
          <EmptyState icon={<FiAward />} title="No branch data yet." />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={placements?.byBranch ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="branch" tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} unit="%" domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="rate" fill="#6366f1" name="Placement Rate (%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Branch-wise Placement Summary
        </h3>
        <Table>
          <Table.Head>
            <tr>
              <Table.Th>Branch</Table.Th>
              <Table.Th>Total Students</Table.Th>
              <Table.Th>Placed</Table.Th>
              <Table.Th>Placement Rate</Table.Th>
            </tr>
          </Table.Head>
          <Table.Body>
            {isLoading ? null : (placements?.byBranch ?? []).length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState icon={<FiAward />} title="No placement data yet." />
                </td>
              </tr>
            ) : (
              (placements?.byBranch ?? [])
                .sort((a, b) => b.rate - a.rate)
                .map((row) => (
                  <tr key={row.branch}>
                    <Table.Td className="font-medium text-slate-900 dark:text-slate-100">{row.branch}</Table.Td>
                    <Table.Td>{row.totalCount}</Table.Td>
                    <Table.Td>{row.placedCount}</Table.Td>
                    <Table.Td>
                      <span
                        className={
                          row.rate >= 70
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : row.rate >= 40
                            ? 'text-amber-600 dark:text-amber-400 font-semibold'
                            : 'text-rose-600 dark:text-rose-400 font-semibold'
                        }
                      >
                        {row.rate.toFixed(1)}%
                      </span>
                    </Table.Td>
                  </tr>
                ))
            )}
          </Table.Body>
        </Table>
      </div>
    </div>
  );
}
