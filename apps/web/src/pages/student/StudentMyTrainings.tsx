import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBookOpen, FiArrowRight } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import { useMyEnrollments } from '@/hooks/queries/useTrainingEnrollment';
import type { TrainingEnrollmentStatus } from '@aip/config';

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'danger' }
> = {
  ENROLLED: { label: 'Enrolled', variant: 'info' },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  DROPPED: { label: 'Dropped', variant: 'danger' },
};

const STATUS_FILTERS: { label: string; value: TrainingEnrollmentStatus }[] = [
  { label: 'Enrolled', value: 'ENROLLED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Completed', value: 'COMPLETED' },
];

export default function StudentMyTrainings() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<TrainingEnrollmentStatus | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useMyEnrollments({
    status: statusFilter || undefined,
    page,
  });

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="My Training Programmes"
        subtitle="Track your enrollments, progress, and certificates."
      />

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setStatusFilter('');
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !statusFilter
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          All
        </button>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setStatusFilter(f.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isError && <ErrorState onRetry={() => void refetch()} />}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {data && data.items.length === 0 && !isLoading && (
        <EmptyState
          icon={<FiBookOpen />}
          title="No enrollments yet"
          description="Browse training programmes and enroll to get started."
          action={
            <Button variant="primary" onClick={() => navigate('/student/training')}>
              Browse Training
            </Button>
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="space-y-3">
            {data.items.map((enrollment) => {
              const cfg = statusConfig[enrollment.status] ?? {
                label: enrollment.status,
                variant: 'default' as const,
              };
              const trainingTitle =
                typeof enrollment.training === 'object' && enrollment.training !== null
                  ? enrollment.training.title
                  : null;
              const trainingRef =
                typeof enrollment.training === 'object' && enrollment.training !== null
                  ? enrollment.training.id
                  : enrollment.training;
              return (
                <div
                  key={enrollment.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 dark:bg-slate-900 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900 text-sm dark:text-slate-100">
                          {trainingTitle ?? `Training #${String(trainingRef).slice(-8)}`}
                        </h3>
                        <Badge variant={cfg.variant} size="sm">
                          {cfg.label}
                        </Badge>
                        {enrollment.certificateId && (
                          <Badge variant="success" size="sm">
                            Certificate Ready
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          Enrolled: {format(new Date(enrollment.enrolledAt), 'MMM d, yyyy')}
                        </span>
                        {enrollment.startedAt && (
                          <span>
                            Started: {format(new Date(enrollment.startedAt), 'MMM d, yyyy')}
                          </span>
                        )}
                        {enrollment.completedAt && (
                          <span>
                            Completed: {format(new Date(enrollment.completedAt), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {(enrollment.status === 'IN_PROGRESS' ||
                        enrollment.status === 'COMPLETED') && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-500 dark:text-slate-400">Progress</span>
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                              {enrollment.progress}%
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full dark:bg-slate-800">
                            <div
                              className="h-2 bg-indigo-600 rounded-full transition-all"
                              style={{ width: `${enrollment.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {enrollment.status !== 'DROPPED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/student/my-trainings/${enrollment.id}`)}
                          className="flex items-center gap-1"
                        >
                          View <FiArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center">
            <Pagination
              page={data.page}
              totalPages={Math.ceil(data.total / data.pageSize)}
              onChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
