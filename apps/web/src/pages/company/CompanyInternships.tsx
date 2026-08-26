import { Link } from 'react-router-dom';
import { FiBook, FiPlus } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { useCompanyInternships } from '@/hooks/queries/useCompanyInternships';
import { format } from 'date-fns';
import type { InternshipStatus } from '@aip/config';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<InternshipStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Draft', variant: 'default' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  CLOSED: { label: 'Closed', variant: 'danger' },
  ARCHIVED: { label: 'Archived', variant: 'default' },
};

export default function CompanyInternships() {
  const { data, isLoading, isError, refetch } = useCompanyInternships();
  const internships = data?.items ?? [];

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Internships"
        subtitle="All internship listings from your company."
        actions={
          <div className="flex gap-2">
            <Link to="/company/internships/manage">
              <Button size="sm" variant="outline">Manage</Button>
            </Link>
            <Link to="/company/internships/new">
              <Button size="sm" iconLeft={<FiPlus className="w-4 h-4" />}>Post Internship</Button>
            </Link>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : internships.length === 0 ? (
        <EmptyState
          icon={<FiBook />}
          title="No internships posted yet"
          description="Create your first internship posting."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {internships.map((internship) => {
            const config = statusConfig[internship.status];
            return (
              <Card key={internship.id}>
                <Card.Body>
                  <div className="flex items-start justify-between gap-2 mb-3">
                     <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight">{internship.title}</h3>
                    <Badge variant={config.variant} size="sm">{config.label}</Badge>
                  </div>
                   <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{internship.location} · {internship.workMode}</p>
                   <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{internship.durationMonths} month{internship.durationMonths !== 1 ? 's' : ''}</p>
                   {internship.stipend != null && (
                     <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      Stipend: {internship.stipend.toLocaleString()} {internship.currency ?? ''}
                    </p>
                  )}
                  {internship.applicationDeadline && (
                     <p className="text-xs text-slate-400 dark:text-slate-500">
                       Deadline: {format(new Date(internship.applicationDeadline), 'MMM d, yyyy')}
                    </p>
                  )}
                  <div className="mt-4">
                    <Link to={`/company/internships/${internship.id}/edit`}>
                      <Button size="sm" variant="outline" className="w-full">Edit</Button>
                    </Link>
                  </div>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
