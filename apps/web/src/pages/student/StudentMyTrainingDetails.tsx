import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiAward, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import Skeleton from '@/components/ui/Skeleton';
import { useMyEnrollment, useUpdateTrainingProgress, useCompleteTraining, useDropEnrollment } from '@/hooks/queries/useTrainingEnrollment';

const statusConfig: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'danger' }> = {
  ENROLLED: { label: 'Enrolled', variant: 'info' },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  DROPPED: { label: 'Dropped', variant: 'danger' },
};

export default function StudentMyTrainingDetails() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const navigate = useNavigate();

  const { data: enrollment, isLoading, isError, refetch } = useMyEnrollment(enrollmentId ?? '');
  const updateProgress = useUpdateTrainingProgress();
  const completeTraining = useCompleteTraining();
  const dropEnrollment = useDropEnrollment();

  const [progressInput, setProgressInput] = useState<string>('');

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !enrollment) {
    return (
      <div className="container-page py-8">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  const cfg = statusConfig[enrollment.status] ?? { label: enrollment.status, variant: 'default' as const };
  const isActive = enrollment.status !== 'DROPPED' && enrollment.status !== 'COMPLETED';
  const enrollmentData = enrollment;

  function handleUpdateProgress() {
    const val = parseInt(progressInput, 10);
    if (isNaN(val) || val < 0 || val > 100) return;
    updateProgress.mutate({ id: enrollmentData.id, progress: val });
    setProgressInput('');
  }

  function handleComplete() {
    completeTraining.mutate(enrollmentData.id);
  }

  function handleDrop() {
    if (!window.confirm('Are you sure you want to drop this enrollment? This cannot be undone.')) return;
    dropEnrollment.mutate(enrollmentData.id, {
      onSuccess: () => navigate('/student/my-trainings'),
    });
  }

  return (
    <div className="container-page py-8 space-y-6">
      <button
        onClick={() => navigate('/student/my-trainings')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <FiArrowLeft className="w-4 h-4" /> Back to My Trainings
      </button>

      <PageHeader
        title="Training Programme"
        subtitle={`Enrollment ID: ${enrollment.id}`}
      />

      {/* Status + metadata */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant={cfg.variant} size="md">{cfg.label}</Badge>
          {enrollment.certificateId && (
            <Badge variant="success" size="md" className="flex items-center gap-1">
              <FiAward className="w-3.5 h-3.5" /> Certificate Ready
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-slate-500 dark:text-slate-400 text-xs">Enrolled</span>
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {format(new Date(enrollment.enrolledAt), 'MMM d, yyyy')}
            </p>
          </div>
          {enrollment.startedAt && (
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-xs">Started</span>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {format(new Date(enrollment.startedAt), 'MMM d, yyyy')}
              </p>
            </div>
          )}
          {enrollment.completedAt && (
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-xs">Completed</span>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {format(new Date(enrollment.completedAt), 'MMM d, yyyy')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progress section */}
      {isActive && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Update Progress</h3>

          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-500 dark:text-slate-400">Current Progress</span>
              <span className="font-semibold text-indigo-600">{enrollment.progress}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full dark:bg-slate-800">
              <div
                className="h-3 bg-indigo-600 rounded-full transition-all"
                style={{ width: `${enrollment.progress}%` }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={progressInput}
              onChange={(e) => setProgressInput(e.target.value)}
              placeholder="0-100"
              className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpdateProgress}
              disabled={updateProgress.isPending || !progressInput}
              loading={updateProgress.isPending}
            >
              Save Progress
            </Button>
          </div>

          {enrollment.status === 'ENROLLED' && enrollment.progress > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Progress started — enrollment moved to In Progress.
            </p>
          )}
        </div>
      )}

      {/* Complete / Drop actions */}
      {isActive && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Finish Training</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Once you've completed all the training content, mark it as complete to receive your certificate.
          </p>
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={handleComplete}
              disabled={completeTraining.isPending}
              loading={completeTraining.isPending}
              className="flex items-center gap-2"
            >
              <FiCheckCircle className="w-4 h-4" /> Mark as Complete
            </Button>
            <Button
              variant="ghost"
              onClick={handleDrop}
              disabled={dropEnrollment.isPending}
              loading={dropEnrollment.isPending}
              className="flex items-center gap-2 text-rose-600 dark:text-rose-400"
            >
              <FiXCircle className="w-4 h-4" /> Drop Enrollment
            </Button>
          </div>
        </div>
      )}

      {/* Certificate section */}
      {enrollment.status === 'COMPLETED' && enrollment.certificateId && (
        <div className="bg-gradient-to-br from-indigo-50 to-slate-50 rounded-xl border border-indigo-100 shadow-sm p-6 dark:from-slate-900 dark:to-slate-900 dark:border-indigo-900/30">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center shrink-0">
              <FiAward className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                Training Certificate
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Your certificate is ready. Download it from your Documents page.
              </p>
              <Button
                variant="primary"
                onClick={() => navigate('/student/documents')}
                className="flex items-center gap-2"
              >
                <FiAward className="w-4 h-4" /> View Certificate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
