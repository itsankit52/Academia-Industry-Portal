/**
 * Phase 9B — "Career Insights" section for the student dashboard.
 *
 * Reuses the careerInsights + benchmark + progression data that the
 * unified /recommendations/me endpoint already returns, so no extra
 * round-trip is needed. Renders the readiness score, top strengths,
 * top gaps, recommended action, and a privacy-safe benchmark.
 *
 * All text is deterministic — no LLM, no external services.
 */

import { FiTarget, FiTrendingUp, FiTrendingDown, FiMinus, FiUsers, FiBarChart2, FiArrowRight } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import SkillChip from '@/components/ui/SkillChip';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { CareerInsights, CareerBenchmark, ReadinessProgression, CareerAction } from '@aip/types';

interface CareerInsightsSectionProps {
  insights?: CareerInsights;
  benchmark?: CareerBenchmark;
  progression?: ReadinessProgression;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function readinessTone(score: number) {
  if (score >= 75) return { ring: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' };
  if (score >= 50) return { ring: 'text-sky-600 dark:text-sky-400', bar: 'bg-sky-500' };
  if (score >= 25) return { ring: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
  return { ring: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500' };
}

function ReadinessBadge({ level }: { level: string }) {
  switch (level) {
    case 'Career Ready':
      return <Badge variant="success">{level}</Badge>;
    case 'Almost There':
      return <Badge variant="info">{level}</Badge>;
    case 'In Progress':
      return <Badge variant="default">{level}</Badge>;
    default:
      return <Badge variant="warning">{level}</Badge>;
  }
}

function ProgressionBadge({ progression }: { progression: ReadinessProgression }) {
  if (progression.previousScore === null) {
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
        <FiMinus className="w-3 h-3" /> Baseline not yet established
      </span>
    );
  }
  if (progression.delta > 0) {
    return (
      <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
        <FiTrendingUp className="w-3 h-3" /> +{progression.delta} points
      </span>
    );
  }
  if (progression.delta < 0) {
    return (
      <span className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
        <FiTrendingDown className="w-3 h-3" /> {progression.delta} points
      </span>
    );
  }
  return (
    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
      <FiMinus className="w-3 h-3" /> No change
    </span>
  );
}

function NextActionCta({ action }: { action: CareerAction }) {
  if (!action.ctaPath) return null;
  return (
    <Link to={action.ctaPath}>
      <Button size="sm" variant="outline" iconRight={<FiArrowRight />}>
        {action.ctaLabel ?? 'Take action'}
      </Button>
    </Link>
  );
}

function BenchmarkCard({ benchmark }: { benchmark: CareerBenchmark }) {
  if (!benchmark.available) {
    return (
      <Card>
        <Card.Header>
          <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <FiUsers /> Peer Benchmark
          </h3>
        </Card.Header>
        <Card.Body>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {benchmark.unavailableReason ?? 'Benchmark unavailable.'}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {benchmark.sampleSize} peers in sample.
          </p>
        </Card.Body>
      </Card>
    );
  }

  const proficiencyDiff =
    benchmark.studentAverageProficiency !== undefined &&
    benchmark.peerAverageProficiency !== undefined
      ? benchmark.studentAverageProficiency - benchmark.peerAverageProficiency
      : null;

  return (
    <Card>
      <Card.Header>
        <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
          <FiUsers /> Peer Benchmark
        </h3>
      </Card.Header>
      <Card.Body className="space-y-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Based on {benchmark.sampleSize} peers.
        </p>
        {proficiencyDiff !== null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Your avg proficiency
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {benchmark.studentAverageProficiency}%
              </span>
              <span
                className={`text-xs font-medium ${
                  proficiencyDiff > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : proficiencyDiff < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500'
                }`}
              >
                {proficiencyDiff > 0 ? '+' : ''}
                {proficiencyDiff}
              </span>
            </div>
          </div>
        )}
        {benchmark.categories && benchmark.categories.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Category comparison
            </p>
            {benchmark.categories.slice(0, 4).map((cat) => (
              <div key={cat.category} className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[120px]">
                  {cat.category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {cat.studentScore}%
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">vs {cat.peerScore}%</span>
                  <Badge
                    variant={
                      cat.verdict === 'STRONGER'
                        ? 'success'
                        : cat.verdict === 'WEAKER'
                          ? 'warning'
                          : 'default'
                    }
                    size="sm"
                  >
                    {cat.verdict === 'STRONGER' ? 'Stronger' : cat.verdict === 'WEAKER' ? 'Weaker' : 'Typical'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

export function CareerInsightsSection({
  insights,
  benchmark,
  progression,
  isLoading,
  isError,
  onRetry,
}: CareerInsightsSectionProps) {
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (isLoading) return <SkeletonCard />;

  if (!insights || (insights.readiness.readinessScore === 0 && insights.topStrengths.length === 0)) {
    return (
      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <FiTarget /> Career Insights
          </h2>
        </Card.Header>
        <Card.Body>
          <EmptyState
            title="Build your profile to unlock insights"
            description="Add skills, take assessments, or upload a resume to see personalized career insights."
            action={
              <div className="flex gap-2">
                <Link to="/student/skills">
                  <Button size="sm">Add Skills</Button>
                </Link>
                <Link to="/student/assessments">
                  <Button size="sm" variant="outline">
                    Take Assessment
                  </Button>
                </Link>
              </div>
            }
          />
        </Card.Body>
      </Card>
    );
  }

  const tone = readinessTone(insights.readiness.readinessScore);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Main readiness card */}
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <FiTarget /> Career Insights
            </h3>
            <ReadinessBadge level={insights.currentLevel} />
          </div>
        </Card.Header>
        <Card.Body className="space-y-4">
          {/* Score */}
          <div>
            <div className="flex items-end gap-2">
              <p className={`text-4xl font-bold tracking-tight ${tone.ring}`}>
                {insights.readiness.readinessScore}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">/100</p>
            </div>
            <ProgressBar value={insights.readiness.readinessScore} className="mt-2" />
          </div>

          {/* Headline */}
          <p className="text-sm text-slate-600 dark:text-slate-300">{insights.headline}</p>

          {/* Progression */}
          {progression && (
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
              <ProgressionBadge progression={progression} />
              {progression.contributingFactors[0] && (
                <span className="text-xs text-slate-400 dark:text-slate-500 text-right max-w-[160px] truncate">
                  {progression.contributingFactors[0]}
                </span>
              )}
            </div>
          )}

          {/* Top strengths */}
          {insights.topStrengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-1.5">
                Top Strengths
              </p>
              <div className="flex flex-wrap gap-1.5">
                {insights.topStrengths.map((s) => (
                  <SkillChip
                    key={s.skillId}
                    name={s.name}
                    proficiency={s.proficiency}
                    className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Top gaps */}
          {insights.topGaps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1.5">
                Top Priorities
              </p>
              <div className="flex flex-wrap gap-1.5">
                {insights.topGaps.map((g) => (
                  <SkillChip
                    key={g.id}
                    name={g.name}
                    className="bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recommended action */}
          {insights.recommendedNextAction && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                Recommended Next Step
              </p>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {insights.recommendedNextAction.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                    {insights.recommendedNextAction.reason}
                  </p>
                </div>
                <NextActionCta action={insights.recommendedNextAction} />
              </div>
            </div>
          )}
        </Card.Body>
        <Card.Footer>
          <Link
            to="/student/skill-profile"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            View full profile →
          </Link>
        </Card.Footer>
      </Card>

      {/* Benchmark */}
      <div className="xl:col-span-1">
        {benchmark && <BenchmarkCard benchmark={benchmark} />}
      </div>

      {/* Action plan shortcut */}
      <Card>
        <Card.Header>
          <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <FiBarChart2 /> Your Action Plan
          </h3>
        </Card.Header>
        <Card.Body className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your personalized roadmap: prioritized steps to close skill gaps, get
            verified, and land your target role.
          </p>
          <Link to="/student/career-plan">
            <Button size="sm" iconRight={<FiArrowRight />} className="w-full">
              View action plan
            </Button>
          </Link>
        </Card.Body>
      </Card>
    </div>
  );
}
