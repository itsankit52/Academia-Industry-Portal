import { Link } from 'react-router-dom';
import { FiBriefcase, FiPlus } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { useCompanyJobs } from '@/hooks/queries/useCompanyJobs';
import { format } from 'date-fns';
import type { JobStatus } from '@aip/config';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<JobStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Draft', variant: 'default' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  CLOSED: { label: 'Closed', variant: 'danger' },
  ARCHIVED: { label: 'Archived', variant: 'default' },
};

export default function CompanyJobs() {
  const { data, isLoading, isError, refetch } = useCompanyJobs();
  const jobs = data?.items ?? [];

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Jobs"
        subtitle="All job postings from your company."
        actions={
          <div className="flex gap-2">
            <Link to="/company/jobs/manage">
              <Button size="sm" variant="outline">Manage</Button>
            </Link>
            <Link to="/company/jobs/new">
              <Button size="sm" iconLeft={<FiPlus className="w-4 h-4" />}>Post Job</Button>
            </Link>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<FiBriefcase />}
          title="No jobs posted yet"
          description="Create your first job posting to start receiving applications."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => {
            const config = statusConfig[job.status];
            return (
              <Card key={job.id}>
                <Card.Body>
                  <div className="flex items-start justify-between gap-2 mb-3">
                     <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight">{job.title}</h3>
                    <Badge variant={config.variant} size="sm">{config.label}</Badge>
                  </div>
                   <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{job.location} · {job.workMode}</p>
                   <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    {job.employmentType.replace('_', ' ')} · {job.openings} opening{job.openings !== 1 ? 's' : ''}
                  </p>
                  {job.applicationDeadline && (
                     <p className="text-xs text-slate-400 dark:text-slate-500">
                      Deadline: {format(new Date(job.applicationDeadline), 'MMM d, yyyy')}
                    </p>
                  )}
                  <div className="mt-4">
                    <Link to={`/company/jobs/${job.id}/edit`}>
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
