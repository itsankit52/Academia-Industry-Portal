import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiUser } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Table, { Tbody, Td, Th, Thead } from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useFacultyOpportunity } from '@/hooks/queries/useFacultyOpportunities';
import { useListOpportunityApplicants } from '@/hooks/queries/useFacultyApplications';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  APPLIED: { label: 'Applied', variant: 'info' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'warning' },
  SHORTLISTED: { label: 'Shortlisted', variant: 'success' },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', variant: 'success' },
  SELECTED: { label: 'Selected', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'default' },
  ONGOING: { label: 'Ongoing', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  OFFER_ACCEPTED: { label: 'Offer Accepted', variant: 'success' },
  OFFER_REJECTED: { label: 'Offer Declined', variant: 'danger' },
  INTERNSHIP_STARTED: { label: 'Internship Started', variant: 'success' },
};

export default function CompanyFacultyApplicants() {
  const { id: oppId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data: opp, isLoading: oppLoading } = useFacultyOpportunity(oppId ?? '');
  const { data, isLoading, isError, refetch } = useListOpportunityApplicants(oppId ?? '', {
    page,
    pageSize: 20,
  });

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Faculty Applicants"
        subtitle={opp ? `Applicants for: ${opp.title}` : 'Loading opportunity...'}
        actions={
          <Button
            variant="outline"
            size="sm"
            iconLeft={<FiArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/company/faculty-opportunities')}
          >
            Back
          </Button>
        }
      />

      {isError && <ErrorState onRetry={() => void refetch()} />}

      <Table>
        <Thead>
          <tr>
            <Th>Faculty</Th>
            <Th>Qualifications</Th>
            <Th>Research Interests</Th>
            <Th>Applied</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </tr>
        </Thead>
        <Tbody>
          {isLoading && <SkeletonTableRows rows={5} cols={6} />}
          {!isLoading && (!data || data.items.length === 0) && (
            <tr>
              <td colSpan={6}>
                <EmptyState
                  icon={<FiUser />}
                  title="No applicants yet"
                  description="Faculty applicants for this opportunity will appear here."
                />
              </td>
            </tr>
          )}
          {data?.items.map((applicant) => {
            const cfg = statusConfig[applicant.status] ?? {
              label: applicant.status,
              variant: 'default' as BadgeVariant,
            };
            return (
              <tr key={applicant.applicationId}>
                <Td>
                  <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                    {applicant.facultyName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {applicant.facultyEmail}
                  </p>
                </Td>
                <Td>
                  {applicant.qualifications && applicant.qualifications.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {applicant.qualifications.slice(0, 2).map((q) => (
                        <Badge key={q} variant="default" size="sm">
                          {q}
                        </Badge>
                      ))}
                      {applicant.qualifications.length > 2 && (
                        <Badge variant="default" size="sm">
                          +{applicant.qualifications.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </Td>
                <Td>
                  {applicant.researchInterests && applicant.researchInterests.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {applicant.researchInterests.slice(0, 2).map((r) => (
                        <Badge key={r} variant="info" size="sm">
                          {r}
                        </Badge>
                      ))}
                      {applicant.researchInterests.length > 2 && (
                        <Badge variant="info" size="sm">
                          +{applicant.researchInterests.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </Td>
                <Td className="text-sm text-slate-600 dark:text-slate-400">
                  {applicant.appliedAt ? format(new Date(applicant.appliedAt), 'MMM d, yyyy') : '—'}
                </Td>
                <Td>
                  <Badge variant={cfg.variant} size="sm">
                    {cfg.label}
                  </Badge>
                </Td>
                <Td>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      navigate(
                        `/company/faculty-opportunities/${oppId}/applicants/${applicant.applicationId}`,
                      )
                    }
                  >
                    View
                  </Button>
                </Td>
              </tr>
            );
          })}
        </Tbody>
      </Table>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
