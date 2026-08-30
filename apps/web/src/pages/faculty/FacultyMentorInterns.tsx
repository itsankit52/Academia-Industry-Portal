import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiUsers, FiFileText, FiCheckCircle } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useMentorAssignedInterns } from '@/hooks/queries/usePhase5B';
import type { ApplicationStatus } from '@aip/config';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  SELECTED: { label: 'Selected', variant: 'info' },
  INTERNSHIP_STARTED: { label: 'Started', variant: 'success' },
  ONGOING: { label: 'Ongoing', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'default' },
};

export default function FacultyMentorInterns() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useMentorAssignedInterns({ page, pageSize: 20 });

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Assigned Interns"
        subtitle="Internships you have been assigned to mentor. Review reports and provide feedback."
      />

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Intern</Table.Th>
            <Table.Th>Internship</Table.Th>
            <Table.Th>Company</Table.Th>
            <Table.Th>Duration</Table.Th>
            <Table.Th>Start Date</Table.Th>
            <Table.Th>Reports</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={5} cols={8} />
          ) : !data?.items.length ? (
            <tr>
              <td colSpan={8}>
                <EmptyState
                  icon={<FiUsers />}
                  title="No assigned interns"
                  description="Internships you are assigned as mentor will appear here."
                />
              </td>
            </tr>
          ) : (
            data.items.map((item) => {
              const cfg = statusConfig[item.status] ?? {
                label: item.status,
                variant: 'default' as BadgeVariant,
              };
              const isCompleted = item.status === 'COMPLETED';

              return (
                <tr key={item.id}>
                  <Table.Td>
                    {item.student ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={item.student.fullName} size="sm" />
                        <div>
                          <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                            {item.student.fullName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.student.email}
                          </p>
                        </div>
                      </div>
                    ) : (
                      '—'
                    )}
                  </Table.Td>
                  <Table.Td>
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                      {item.opportunity.title}
                    </p>
                    {item.opportunity.durationMonths ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.opportunity.durationMonths}mo
                      </p>
                    ) : null}
                  </Table.Td>
                  <Table.Td>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {item.opportunity.company || '—'}
                    </p>
                  </Table.Td>
                  <Table.Td>
                    {item.opportunity.durationMonths ? (
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {item.opportunity.durationMonths}mo
                      </span>
                    ) : '—'}
                  </Table.Td>
                  <Table.Td>
                    {item.startDate ? (
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {format(new Date(item.startDate), 'MMM d, yyyy')}
                      </span>
                    ) : item.startedAt ? (
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {format(new Date(item.startedAt), 'MMM d, yyyy')}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Table.Td>
                  <Table.Td>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      item.reportCount > 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                    }`}>
                      <FiFileText className="w-3 h-3" />
                      {item.reportCount} {item.reportCount === 1 ? 'report' : 'reports'}
                    </span>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.reportCount > 0 ? (
                        <Link
                          to={`/faculty/applications/${item.id}/reports`}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors no-underline"
                        >
                          <FiFileText className="w-3 h-3" />
                          Review Reports
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No reports</span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
                          <FiCheckCircle className="w-3 h-3" />
                          Completed
                        </span>
                      )}
                    </div>
                  </Table.Td>
                </tr>
              );
            })
          )}
        </Table.Body>
      </Table>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
