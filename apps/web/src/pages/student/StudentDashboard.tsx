import {
  FiBriefcase,
  FiCalendar,
  FiStar,
  FiAlertCircle,
  FiZap,
  FiActivity,
  FiTarget,
  FiTrendingUp,
  FiBookOpen,
  FiClock,
} from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import SkillChip from '@/components/ui/SkillChip';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ApplicationCard from '@/components/cards/ApplicationCard';
import InterviewCard from '@/components/cards/InterviewCard';
import { useStudentDashboard } from '@/hooks/queries/useStudentDashboard';
import { useAssessmentSummary } from '@/hooks/queries/useAssessmentSummary';
import { useSkillProfile } from '@/hooks/queries/useSkillProfile';
import { usePersonalizedRecommendations } from '@/hooks/queries/usePersonalizedRecommendations';
import { usePlacementReadiness } from '@/hooks/queries/usePlacementReadiness';
import { usePlacementOutcomes } from '@/hooks/queries/usePlacementOutcomes';
import { useAuthStore } from '@/store/auth';
import { RecommendedSection } from '@/components/recommendations/RecommendedSection';
import { CareerInsightsSection } from '@/components/recommendations/CareerInsightsSection';
import { PlacementReadinessCard } from '@/components/placement/PlacementReadinessCard';
import { OutcomeFunnel } from '@/components/placement/OutcomeFunnel';

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
  const { data: skillProfile, isLoading: skillProfileLoading } = useSkillProfile();
  // Phase 9B — personalized recommendations now carries career insights, benchmark, progression
  const {
    data: personalized,
    isLoading: recsLoading,
    isError: recsError,
    refetch: refetchRecs,
  } = usePersonalizedRecommendations();
  // Phase 10 — placement readiness + outcome hooks
  const {
    data: readiness,
    isLoading: readinessLoading,
    isError: readinessError,
    refetch: refetchReadiness,
  } = usePlacementReadiness();
  const {
    data: outcomes,
    isLoading: outcomesLoading,
    isError: outcomesError,
    refetch: refetchOutcomes,
  } = usePlacementOutcomes();

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

          {/* Phase 14A: Internship lifecycle sub-row — surfaces how many
              applications have moved past selection into an actual internship
              (selected/ongoing/completed), separated from the generic
              appliedCount which includes rejects/withdrawals. */}
          {(() => {
            const recent = data.recentApplications ?? [];
            const selected = recent.filter((a) => a.status === 'SELECTED').length;
            const ongoing = recent.filter(
              (a) =>
                a.status === 'INTERNSHIP_STARTED' ||
                a.status === 'ONGOING' ||
                a.status === 'OFFER_ACCEPTED',
            ).length;
            const completed = recent.filter((a) => a.status === 'COMPLETED').length;
            const activeInternships = Math.max(ongoing, selected);
            if (activeInternships === 0 && completed === 0) return null;
            return (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="Selected for Internship" value={selected} icon={<FiBriefcase />} />
                <StatCard
                  label="Active Internships"
                  value={activeInternships}
                  icon={<FiActivity />}
                />
                <StatCard label="Completed Internships" value={completed} icon={<FiClock />} />
              </div>
            );
          })()}

          {/* Skill Readiness Snapshot */}
          <Card>
            <Card.Header>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                  <FiActivity /> Skill Snapshot
                </h2>
                <Link
                  to="/student/skill-profile"
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 no-underline hover:underline"
                >
                  View full profile →
                </Link>
              </div>
            </Card.Header>
            <Card.Body>
              {skillProfileLoading ? (
                <SkeletonCard />
              ) : skillProfile && skillProfile.totals.totalSkills > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Skill Readiness
                    </p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {skillProfile.totals.readinessScore}%
                    </p>
                    <ProgressBar value={skillProfile.totals.readinessScore} className="mt-2" />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      {skillProfile.totals.technicalCount} technical ·{' '}
                      {skillProfile.totals.softSkillsCount} soft ·{' '}
                      {skillProfile.totals.assessedSkillsCount} verified
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                      <FiTarget /> Top Strengths
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {skillProfile.strengths.slice(0, 3).map((s) => (
                        <SkillChip
                          key={s.skill.id}
                          name={s.skill.name}
                          proficiency={s.proficiency}
                          className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        />
                      ))}
                      {skillProfile.strengths.length === 0 && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          No strengths yet.
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                      <FiTrendingUp /> Skills to Improve
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(skillProfile.gaps.length > 0
                        ? skillProfile.gaps
                        : skillProfile.industry.topMissing
                      )
                        .slice(0, 3)
                        .map((s) => {
                          const isGap = 'proficiency' in s;
                          const name = isGap ? s.skill.name : s.name;
                          return (
                            <SkillChip
                              key={isGap ? s.skill.id : s.id}
                              name={name}
                              proficiency={isGap ? s.proficiency : undefined}
                              className="bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                            />
                          );
                        })}
                      {skillProfile.gaps.length === 0 &&
                        skillProfile.industry.topMissing.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            All caught up.
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Build your skill profile
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Add skills, take an assessment, or upload a resume to see your readiness.
                    </p>
                  </div>
                  <Link to="/student/skills">
                    <Button size="sm" iconLeft={<FiBookOpen />}>
                      Add skills
                    </Button>
                  </Link>
                </div>
              )}
            </Card.Body>
          </Card>

          {assessmentSummary &&
            (assessmentSummary.totalCount === 0 ? (
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
                    <div
                      className={`text-4xl font-bold tabular-nums ${assessmentScoreColor(assessmentSummary.latestScore)}`}
                    >
                      {assessmentSummary.latestScore ?? '—'}
                      <span className="text-base font-normal text-slate-400 dark:text-slate-500">
                        /100
                      </span>
                    </div>
                    {assessmentSummary.latestStatus && (
                      <Badge
                        variant={
                          assessmentStatusConfig[assessmentSummary.latestStatus]?.variant ??
                          'default'
                        }
                      >
                        {assessmentStatusConfig[assessmentSummary.latestStatus]?.label ??
                          assessmentSummary.latestStatus}
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
                      {formatDistanceToNow(new Date(assessmentSummary.latestDate), {
                        addSuffix: true,
                      })}
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
            ))}

          {/* Phase 9A — Personalized Recommendations */}
          <RecommendedSection onRetry={() => void refetch()} />

          {/* Phase 10 — Placement Readiness & Outcomes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PlacementReadinessCard
              data={readiness}
              isLoading={readinessLoading}
              isError={readinessError}
              onRetry={() => void refetchReadiness()}
            />
            <OutcomeFunnel
              data={outcomes}
              isLoading={outcomesLoading}
              isError={outcomesError}
              onRetry={() => void refetchOutcomes()}
              variant="student"
            />
          </div>

          {/* Phase 9B — Career Insights */}
          <CareerInsightsSection
            insights={personalized?.careerInsights}
            benchmark={personalized?.benchmark}
            progression={personalized?.progression}
            isLoading={recsLoading}
            isError={recsError}
            onRetry={() => void refetchRecs()}
          />

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
