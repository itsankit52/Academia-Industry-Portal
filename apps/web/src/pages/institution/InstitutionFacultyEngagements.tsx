import { FiBriefcase } from 'react-icons/fi';
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
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useThemeStore } from '@/store/theme';
import {
  useInstitutionFacultyEngagements,
  type FacultyEngagementRow,
} from '@/hooks/queries/useInstitutionAnalytics';

function ChartSkeleton() {
  return <div className="h-[300px] animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg" />;
}

function formatTypeLabel(value: string): string {
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

export default function InstitutionFacultyEngagements() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const axisColor = isDark ? '#64748b' : '#94a3b8';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  const { data, isLoading, isError, refetch } = useInstitutionFacultyEngagements();

  if (isError) return <ErrorState onRetry={refetch} />;

  const byOpportunityType = data?.byOpportunityType ?? [];
  const byCompany = data?.byCompany ?? [];
  const byFaculty = (data?.byFaculty ?? []) as unknown as FacultyEngagementRow[];
  const hasAnyData =
    (data?.totalApplications ?? 0) > 0 || byOpportunityType.length > 0 || byCompany.length > 0;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Faculty Industry Engagements"
        subtitle="Monitor faculty participation in industry opportunities, including applications, selections, and completions."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Faculty"
              value={data?.totalFaculty ?? 0}
              icon={<FiBriefcase />}
            />
            <StatCard
              label="Total Applications"
              value={data?.totalApplications ?? 0}
              icon={<FiBriefcase />}
            />
            <StatCard label="Selected" value={data?.selected ?? 0} icon={<FiBriefcase />} />
            <StatCard label="Active" value={data?.active ?? 0} icon={<FiBriefcase />} />
            <StatCard label="Completed" value={data?.completed ?? 0} icon={<FiBriefcase />} />
          </>
        )}
      </div>

      {!isLoading && !hasAnyData ? (
        <EmptyState
          icon={<FiBriefcase />}
          title="No faculty industry engagements yet"
          description="Engagement data will appear here once faculty begin applying to industry opportunities."
        />
      ) : (
        <>
          {byOpportunityType.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Applications by Opportunity Type
              </h3>
              {isLoading ? (
                <ChartSkeleton />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={byOpportunityType.map((row) => ({
                      ...row,
                      label: formatTypeLabel(row.opportunityType),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisColor }} />
                    <YAxis tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#6366f1" name="Applications" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
                By Opportunity Type
              </h3>
              <Table>
                <Table.Head>
                  <tr>
                    <Table.Th>Opportunity Type</Table.Th>
                    <Table.Th>Applications</Table.Th>
                  </tr>
                </Table.Head>
                <Table.Body>
                  {byOpportunityType.length === 0 ? (
                    <tr>
                      <td colSpan={2}>
                        <EmptyState icon={<FiBriefcase />} title="No data available." />
                      </td>
                    </tr>
                  ) : (
                    byOpportunityType.map((row) => (
                      <tr key={row.opportunityType}>
                        <Table.Td>
                          <Badge variant="info" size="sm">
                            {formatTypeLabel(row.opportunityType)}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{row.count}</Table.Td>
                      </tr>
                    ))
                  )}
                </Table.Body>
              </Table>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
                By Company
              </h3>
              <Table>
                <Table.Head>
                  <tr>
                    <Table.Th>Company</Table.Th>
                    <Table.Th>Applications</Table.Th>
                  </tr>
                </Table.Head>
                <Table.Body>
                  {byCompany.length === 0 ? (
                    <tr>
                      <td colSpan={2}>
                        <EmptyState icon={<FiBriefcase />} title="No company data available." />
                      </td>
                    </tr>
                  ) : (
                    [...byCompany]
                      .sort((a, b) => b.count - a.count)
                      .map((row) => (
                        <tr key={row.companyId}>
                          <Table.Td className="font-medium text-slate-900 dark:text-slate-100">
                            {row.companyName}
                          </Table.Td>
                          <Table.Td>{row.count}</Table.Td>
                        </tr>
                      ))
                  )}
                </Table.Body>
              </Table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
              By Faculty
            </h3>
            <Table>
              <Table.Head>
                <tr>
                  <Table.Th>Faculty</Table.Th>
                  <Table.Th>Department</Table.Th>
                  <Table.Th>Applied</Table.Th>
                  <Table.Th>Selected</Table.Th>
                  <Table.Th>Active</Table.Th>
                  <Table.Th>Completed</Table.Th>
                </tr>
              </Table.Head>
              <Table.Body>
                {byFaculty.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={<FiBriefcase />}
                        title="No faculty engagement data available."
                      />
                    </td>
                  </tr>
                ) : (
                  byFaculty.map((row) => (
                    <tr key={row.facultyProfileId}>
                      <Table.Td className="font-medium text-slate-900 dark:text-slate-100">
                        {row.fullName}
                      </Table.Td>
                      <Table.Td>
                        {row.department ? (
                          <Badge variant="default" size="sm">
                            {row.department}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </Table.Td>
                      <Table.Td>{row.applied}</Table.Td>
                      <Table.Td>
                        {row.selected > 0 ? (
                          <Badge variant="success" size="sm">
                            {row.selected}
                          </Badge>
                        ) : (
                          row.selected
                        )}
                      </Table.Td>
                      <Table.Td>
                        {row.active > 0 ? (
                          <Badge variant="info" size="sm">
                            {row.active}
                          </Badge>
                        ) : (
                          row.active
                        )}
                      </Table.Td>
                      <Table.Td>
                        {row.completed > 0 ? (
                          <Badge variant="warning" size="sm">
                            {row.completed}
                          </Badge>
                        ) : (
                          row.completed
                        )}
                      </Table.Td>
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
