/**
 * Phase 15B — Student Training Enrollment Details
 *
 * Three sections:
 *  1. Module + lesson browser (the in-platform content)
 *  2. Manual progress (legacy / non-internal trainings)
 *  3. Reassessment recommendation (post-completion)
 */
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiAward,
  FiCheckCircle,
  FiXCircle,
  FiPlay,
  FiFileText,
  FiBookOpen,
  FiHelpCircle,
  FiClock,
  FiRefreshCw,
  FiList,
  FiTarget,
} from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import {
  useMyEnrollment,
  useUpdateTrainingProgress,
  useCompleteTraining,
  useDropEnrollment,
} from '@/hooks/queries/useTrainingEnrollment';
import {
  useTrainingContent,
  useCompleteLesson,
  useReassessmentRecommendation,
} from '@/hooks/queries/useTrainingContent';

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'danger' }
> = {
  ENROLLED: { label: 'Enrolled', variant: 'info' },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  DROPPED: { label: 'Dropped', variant: 'danger' },
};

const lessonTypeIcons: Record<string, React.ReactNode> = {
  VIDEO: <FiPlay className="w-3.5 h-3.5" />,
  ARTICLE: <FiFileText className="w-3.5 h-3.5" />,
  QUIZ: <FiHelpCircle className="w-3.5 h-3.5" />,
  RESOURCE: <FiBookOpen className="w-3.5 h-3.5" />,
};

const lessonTypeColors: Record<string, string> = {
  VIDEO: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
  ARTICLE: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300',
  QUIZ: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  RESOURCE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
};

interface CompletedSet {
  [lessonId: string]: true;
}

function extractCompleted(
  enrollment: { completedLessons?: Array<string | { _id?: string; id?: string }> } | undefined,
): CompletedSet {
  const set: CompletedSet = {};
  const list = enrollment?.completedLessons ?? [];
  for (const item of list) {
    if (typeof item === 'string') set[item] = true;
    else if (item && typeof item === 'object') {
      const id =
        (item as { _id?: string; id?: string })._id ?? (item as { _id?: string; id?: string }).id;
      if (id) set[String(id)] = true;
    }
  }
  return set;
}

export default function StudentMyTrainingDetails() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const navigate = useNavigate();

  const { data: enrollment, isLoading, isError, refetch } = useMyEnrollment(enrollmentId ?? '');
  const updateProgress = useUpdateTrainingProgress();
  const completeTraining = useCompleteTraining();
  const dropEnrollment = useDropEnrollment();

  const [progressInput, setProgressInput] = useState<string>('');
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);

  const trainingId = useMemo(() => {
    if (!enrollment) return '';
    const t = enrollment.training as { id?: string; _id?: string } | string | undefined;
    if (typeof t === 'string') return t;
    return t?.id ?? t?._id ?? '';
  }, [enrollment]);

  const { data: content, isLoading: contentLoading } = useTrainingContent(trainingId);
  const completeLesson = useCompleteLesson(trainingId, enrollmentId ?? '');
  const { data: reassessment, refetch: refetchReassess } = useReassessmentRecommendation(
    enrollmentId ?? '',
  );

  const completedSet = extractCompleted(enrollment);

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
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

  const cfg = statusConfig[enrollment.status] ?? {
    label: enrollment.status,
    variant: 'default' as const,
  };
  const isActive = enrollment.status !== 'DROPPED' && enrollment.status !== 'COMPLETED';

  function handleUpdateProgress() {
    const val = parseInt(progressInput, 10);
    if (isNaN(val) || val < 0 || val > 100) return;
    updateProgress.mutate({ id: enrollment!.id, progress: val });
    setProgressInput('');
  }

  function handleComplete() {
    completeTraining.mutate(enrollment!.id, {
      onSuccess: () => void refetchReassess(),
    });
  }

  function handleDrop() {
    if (!window.confirm('Are you sure you want to drop this enrollment? This cannot be undone.'))
      return;
    dropEnrollment.mutate(enrollment!.id, {
      onSuccess: () => navigate('/student/my-trainings'),
    });
  }

  function handleCompleteLesson(lessonId: string) {
    completeLesson.mutate(lessonId);
  }

  const totalLessons = content?.totalLessons ?? enrollment.totalLessons ?? 0;
  const completedCount = Object.keys(completedSet).length;
  const computedProgress =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : enrollment.progress;

  return (
    <div className="container-page py-8 space-y-6">
      <button
        onClick={() => navigate('/student/my-trainings')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <FiArrowLeft className="w-4 h-4" /> Back to My Trainings
      </button>

      <PageHeader
        title={
          typeof enrollment.training === 'object' ? enrollment.training.title : 'Training Programme'
        }
        subtitle={`Enrollment ID: ${enrollment.id}`}
      />

      {/* Status + metadata */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant={cfg.variant} size="md">
            {cfg.label}
          </Badge>
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
          {totalLessons > 0 && (
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-xs">Lessons</span>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {completedCount} of {totalLessons}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Training content — modules + lessons */}
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <FiList /> Training Content
            </h2>
            {totalLessons > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {completedCount} of {totalLessons} lessons • {computedProgress}%
              </span>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {contentLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : !content || content.modules.length === 0 ? (
            <EmptyState
              icon={<FiList />}
              title="No in-platform content"
              description="This training uses external registration. Track your progress manually below."
            />
          ) : (
            <div className="space-y-2">
              {content.modules.map((mod) => {
                const isOpen = openModuleId === mod.id || openModuleId === null;
                const moduleCompleted =
                  mod.lessons.length > 0 && mod.lessons.every((l) => completedSet[l.id]);
                return (
                  <div
                    key={mod.id}
                    className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setOpenModuleId(isOpen && mod.lessons.length > 0 ? null : mod.id)
                      }
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                            moduleCompleted
                              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {moduleCompleted ? (
                            <FiCheckCircle className="w-3.5 h-3.5" />
                          ) : (
                            mod.order + 1
                          )}
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {mod.title}
                          </h3>
                          {mod.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                              {mod.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        {mod.lessons.length} {mod.lessons.length === 1 ? 'lesson' : 'lessons'}
                      </span>
                    </button>

                    {isOpen && mod.lessons.length > 0 && (
                      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                        {mod.lessons.map((lesson) => {
                          const done = completedSet[lesson.id];
                          return (
                            <div
                              key={lesson.id}
                              className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span
                                  className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                                    lessonTypeColors[lesson.type] ?? 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {lessonTypeIcons[lesson.type]}
                                  {lesson.type}
                                </span>
                                <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                  {lesson.title}
                                </span>
                                {lesson.durationMinutes > 0 && (
                                  <span className="shrink-0 text-xs text-slate-400 flex items-center gap-0.5">
                                    <FiClock className="w-3 h-3" />
                                    {lesson.durationMinutes}m
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {done ? (
                                  <Badge variant="success" size="sm">
                                    <span className="flex items-center gap-0.5">
                                      <FiCheckCircle className="w-3 h-3" /> Done
                                    </span>
                                  </Badge>
                                ) : (
                                  isActive && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleCompleteLesson(lesson.id)}
                                      loading={
                                        completeLesson.isPending &&
                                        completeLesson.variables === lesson.id
                                      }
                                      disabled={completeLesson.isPending}
                                    >
                                      Mark Done
                                    </Button>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Manual progress (fallback for EXTERNAL trainings) */}
      {isActive && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Manual Progress</h3>

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
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Updated automatically as you complete lessons above. Use this only for offline /
              external work.
            </p>
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
            Once you've completed all the training content, mark it as complete to receive your
            certificate.
          </p>
          <div className="flex gap-3 flex-wrap">
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

      {/* Reassessment recommendation after completion */}
      {enrollment.status === 'COMPLETED' && reassessment && (
        <Card>
          <Card.Header>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <FiRefreshCw /> Reassess Skills
            </h2>
          </Card.Header>
          <Card.Body className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">{reassessment.message}</p>
            {reassessment.coveredSkills.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                  Skills covered:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {reassessment.coveredSkills.map((s) => (
                    <span
                      key={s.id}
                      className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-xs font-medium"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/student/assessments')}
              iconLeft={<FiTarget />}
            >
              Take an Assessment
            </Button>
          </Card.Body>
        </Card>
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
