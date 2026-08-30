import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiUsers, FiFileText, FiCheckCircle, FiUser } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useActiveInterns } from '@/hooks/queries/usePhase5B';
import type { ApplicationStatus } from '@aip/config';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  INTERNSHIP_STARTED: { label: 'Started', variant: 'success' },
  ONGOING: { label: 'Ongoing', variant: 'success' },
};

export default function CompanyActiveInterns() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useActiveInterns({ page, pageSize: 20 });

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Active Interns"
        subtitle="Interns currently on internship — manage mentors, view reports, and mark completion."
      />

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Intern</Table.Th>
            <Table.Th>Internship</Table.Th>
            <Table.Th>Duration</Table.Th>
            <Table.Th>Start Date</Table.Th>
            <Table.Th>Expected End</Table.Th>
            <Table.Th>Reports</Table.Th>
            <Table.Th>Mentor</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={5} cols={9} />
          ) : !data?.items.length ? (
            <tr>
              <td colSpan={9}>
                <EmptyState
                  icon={<FiUsers />}
                  title="No active interns"
                  description="Interns with INTERNSHIP_STARTED or ONGOING status will appear here."
                />
              </td>
            </tr>
          ) : (
            data.items.map((item) => {
              const cfg = statusConfig[item.status] ?? {
                label: item.status,
                variant: 'default' as BadgeVariant,
              };
              const isOngoing = item.status === 'ONGOING';

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
                    {item.opportunity.stipend ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.opportunity.currency ?? '₹'}{item.opportunity.stipend.toLocaleString()}/mo
                      </p>
                    ) : null}
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
                    {item.expectedEndDate ? (
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {format(new Date(item.expectedEndDate), 'MMM d, yyyy')}
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
                    {item.mentor ? (
                      <div className="flex items-center gap-1.5">
                        <FiUser className="w-3.5 h-3.5 text-slate-400" />
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {item.mentor.expertise?.slice(0, 2).join(', ') ?? 'Mentor'}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {item.mentor.yearsExperience ? `${item.mentor.yearsExperience}y exp` : ''}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500 italic">Unassigned</span>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => navigate(`/company/applicants/${item.id}`)}
                        className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        Manage
                      </button>
                      {item.reportCount > 0 && (
                        <Link
                          to={`/company/applications/${item.id}/reports`}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors no-underline"
                        >
                          <FiFileText className="w-3 h-3" />
                          Reports
                        </Link>
                      )}
                      {isOngoing && (
                        <Link
                          to={`/company/applicants/${item.id}`}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors no-underline"
                        >
                          <FiCheckCircle className="w-3 h-3" />
                          Complete
                        </Link>
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
