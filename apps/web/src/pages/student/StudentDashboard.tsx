import { FiBriefcase, FiCalendar, FiStar, FiAlertCircle, FiZap } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ApplicationCard from '@/components/cards/ApplicationCard';
import InterviewCard from '@/components/cards/InterviewCard';
import { useStudentDashboard } from '@/hooks/queries/useStudentDashboard';
import { useAssessmentSummary } from '@/hooks/queries/useAssessmentSummary';
import { useAuthStore } from '@/store/auth';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const assessmentStatusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  GENERATED: { label: 'Ready', variant: 'info' },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning' },
  SUBMITTED: { label: 'Submitted', variant: 'default' },
  EVALUATED: { label: 'Evaluated', variant: 'success' },
};

function assessmentScoreColor(score?: number) {
  if (score === undefined) return 'text-slate-400 dark:text-slate-500';
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, refetch } = useStudentDashboard();
  const { data: assessmentSummary } = useAssessmentSummary();

  const firstName = user?.email.split('@')[0] ?? 'Student';

  return (
    <div className="container-page py-8 space-y-8">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Here's your placement activity at a glance."
      />

      {isError && <ErrorState onRetry={() => void refetch()} />}

      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Applications"
              value={data.appliedCount ?? 0}
              icon={<FiBriefcase />}
            />
            <StatCard
              label="Interviews Scheduled"
              value={data.interviewCount ?? 0}
              icon={<FiCalendar />}
            />
            <StatCard
              label="Match Recommendations"
              value={data.recommendationCount ?? 0}
              icon={<FiStar />}
            />
            <StatCard
              label="Skill Gaps"
              value={data.missingSkillsCount ?? 0}
              icon={<FiAlertCircle />}
            />
          </div>

          {assessmentSummary && (
            assessmentSummary.totalCount === 0 ? (
              <Card>
                <Card.Body className="flex flex-col items-center text-center py-8 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xl">
                    <FiZap />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Take your first AI-generated skill assessment
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Test your knowledge and get instant AI feedback
                    </p>
                  </div>
                  <Button size="sm" onClick={() => navigate('/student/assessments')}>
                    Generate Assessment
                  </Button>
                </Card.Body>
              </Card>
            ) : (
              <Card>
                <Card.Header>
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Latest Assessment
                  </h2>
                </Card.Header>
                <Card.Body className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className={`text-4xl font-bold tabular-nums ${assessmentScoreColor(assessmentSummary.latestScore)}`}>
                      {assessmentSummary.latestScore ?? '—'}
                      <span className="text-base font-normal text-slate-400 dark:text-slate-500">/100</span>
                    </div>
                    {assessmentSummary.latestStatus && (
                      <Badge
                        variant={assessmentStatusConfig[assessmentSummary.latestStatus]?.variant ?? 'default'}
                      >
                        {assessmentStatusConfig[assessmentSummary.latestStatus]?.label ?? assessmentSummary.latestStatus}
                      </Badge>
                    )}
                  </div>
                  {assessmentSummary.latestSkills && assessmentSummary.latestSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {assessmentSummary.latestSkills.slice(0, 4).map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                  {assessmentSummary.latestDate && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDistanceToNow(new Date(assessmentSummary.latestDate), { addSuffix: true })}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/student/assessments/${assessmentSummary.latestId}`)}
                    >
                      View Result
                    </Button>
                    <Button size="sm" onClick={() => navigate('/student/assessments')}>
                      Take New
                    </Button>
                  </div>
                </Card.Body>
                <Card.Footer>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Total: {assessmentSummary.totalCount} • Average:{' '}
                    {assessmentSummary.averageScore !== undefined
                      ? `${assessmentSummary.averageScore.toFixed(0)}/100`
                      : '—'}
                  </p>
                </Card.Footer>
              </Card>
            )
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Recent Applications
              </h2>
              {(data.recentApplications ?? []).length === 0 ? (
                <EmptyState
                  title="No applications yet"
                  description="Start applying to jobs and internships to track them here."
                />
              ) : (
                <div className="space-y-3">
                  {(data.recentApplications ?? []).slice(0, 5).map((app) => (
                    <ApplicationCard key={app.id} application={app} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Upcoming Interviews
              </h2>
              {(data.upcomingInterviews ?? []).length === 0 ? (
                <EmptyState
                  title="No upcoming interviews"
                  description="Interviews will appear here once scheduled by companies."
                />
              ) : (
                <div className="space-y-3">
                  {(data.upcomingInterviews ?? []).slice(0, 5).map((iv) => (
                    <InterviewCard key={iv.id} interview={iv} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
