import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiPlus, FiTrash2, FiXCircle } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Table, { Tbody, Td, Th, Thead } from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import {
  useCloseFacultyOpportunity,
  useDeleteFacultyOpportunity,
  useMyFacultyOpportunities,
} from '@/hooks/queries/useFacultyOpportunities';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusVariant: Record<string, BadgeVariant> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  CLOSED: 'warning',
  ARCHIVED: 'default',
};

const typeLabel: Record<string, string> = {
  FACULTY_INTERNSHIP: 'Faculty Internship',
  FDP: 'FDP',
  CONSULTANCY: 'Consultancy',
  COLLABORATIVE_RESEARCH: 'Collab. Research',
  PROJECT: 'Project',
  APPRENTICESHIP: 'Apprenticeship',
};

export default function CompanyManageFacultyOpps() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useMyFacultyOpportunities({ page, pageSize: 12 });
  const closeMut = useCloseFacultyOpportunity();
  const deleteMut = useDeleteFacultyOpportunity();

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Faculty Programs"
        subtitle="Manage the faculty opportunities you have posted."
        actions={
          <Link to="/company/faculty-opportunities/new">
            <Button size="sm" iconLeft={<FiPlus className="w-4 h-4" />}>
              New Opportunity
            </Button>
          </Link>
        }
      />

      {isError && <ErrorState onRetry={() => void refetch()} />}

      <Card>
        <Card.Body className="p-0">
          {(isLoading || (data && data.items.length > 0)) && (
            <Table>
              <Thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Type</Th>
                  <Th>Deadline</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </Thead>
              <Tbody>
                {isLoading && <SkeletonTableRows rows={5} cols={5} />}
                {data?.items.map((opp) => (
                  <tr key={opp.id}>
                    <Td>
                      <button
                        onClick={() => navigate(`/faculty/opportunities/${opp.id}`)}
                        className="font-medium text-slate-900 dark:text-slate-100 text-sm hover:text-indigo-600"
                      >
                        {opp.title}
                      </button>
                    </Td>
                    <Td>
                      <Badge variant="default" size="sm">
                        {typeLabel[opp.opportunityType] ?? opp.opportunityType}
                      </Badge>
                    </Td>
                    <Td>{format(new Date(opp.applicationDeadline), 'MMM d, yyyy')}</Td>
                    <Td>
                      <Badge variant={statusVariant[opp.status] ?? 'default'} size="sm">
                        {opp.status}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          iconLeft={<FiEdit2 className="w-4 h-4" />}
                          onClick={() => navigate(`/company/faculty-opportunities/${opp.id}/edit`)}
                        >
                          Edit
                        </Button>
                        {opp.status === 'PUBLISHED' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={<FiXCircle className="w-4 h-4" />}
                            onClick={() => setConfirmClose(opp.id)}
                          >
                            Close
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          iconLeft={<FiTrash2 className="w-4 h-4" />}
                          onClick={() => setConfirmDelete(opp.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          )}

          {data && data.items.length === 0 && !isLoading && (
            <EmptyState
              title="No faculty opportunities yet"
              description="Post your first faculty program to get started."
            />
          )}
        </Card.Body>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={!!confirmClose}
        title="Close Opportunity"
        description="Applicants will no longer be able to apply. Continue?"
        confirmLabel="Close"
        variant="danger"
        loading={closeMut.isPending}
        onConfirm={() => {
          if (!confirmClose) return;
          closeMut.mutate(confirmClose, {
            onSuccess: () => setConfirmClose(null),
          });
        }}
        onCancel={() => setConfirmClose(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Opportunity"
        description="This will permanently delete the opportunity. Continue?"
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMut.isPending}
        onConfirm={() => {
          if (!confirmDelete) return;
          deleteMut.mutate(confirmDelete, {
            onSuccess: () => setConfirmDelete(null),
          });
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
