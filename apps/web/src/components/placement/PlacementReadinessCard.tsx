/**
 * Phase 10 — Placement Readiness Card component.
 *
 * Displays the deterministic placement-readiness snapshot: overall score, band,
 * component breakdown, strengths, blockers, and recommended actions. All data
 * is server-generated and rendered directly — no fabricated values.
 */

import { FiTarget, FiCheckCircle, FiAlertTriangle, FiArrowRight } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import type {
  PlacementReadiness,
  PlacementComponentScore,
  PlacementStrength,
  PlacementBlocker,
  PlacementNextAction,
} from '@aip/types';

/* ─── Sub-components ──────────────────────────────────────────────── */

function readinessColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 65) return 'text-sky-600 dark:text-sky-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function readinessBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 65) return 'bg-sky-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
}

function readinessBadgeVariant(level: string): 'success' | 'info' | 'warning' | 'danger' | 'default' {
  switch (level) {
    case 'PLACEMENT_READY': return 'success';
    case 'NEARLY_READY': return 'info';
    case 'DEVELOPING': return 'default';
    case 'NEEDS_IMPROVEMENT': return 'warning';
    case 'NOT_READY': return 'danger';
    default: return 'default';
  }
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'text-rose-700 dark:text-rose-400';
    case 'HIGH': return 'text-amber-700 dark:text-amber-400';
    case 'MEDIUM': return 'text-sky-700 dark:text-sky-400';
    case 'LOW': return 'text-slate-500 dark:text-slate-400';
    default: return 'text-slate-600 dark:text-slate-300';
  }
}

function severityBg(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'bg-rose-100 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700';
    case 'HIGH': return 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700';
    case 'MEDIUM': return 'bg-sky-100 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700';
    case 'LOW': return 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700';
    default: return 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700';
  }
}

function ComponentRow({ comp }: { comp: PlacementComponentScore }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {comp.label}
        </span>
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
          {comp.score}
          <span className="font-normal text-slate-400">/100</span>
        </span>
      </div>
      <ProgressBar
        value={comp.score}
        className="h-1.5"
      />
      {comp.evidence[0] && (
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {comp.evidence[0]}
        </p>
      )}
    </div>
  );
}

function StrengthItem({ strength }: { strength: PlacementStrength }) {
  return (
    <li className="flex items-start gap-2">
      <FiCheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{strength.label}</span>
        {strength.value && (
          <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">· {strength.value}</span>
        )}
        {strength.detail && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{strength.detail}</p>
        )}
      </div>
    </li>
  );
}

function BlockerItem({ blocker }: { blocker: PlacementBlocker }) {
  return (
    <li
      className={`flex items-start gap-2 p-2.5 rounded-lg border ${severityBg(blocker.severity)}`}
    >
      <FiAlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${severityColor(blocker.severity)}`} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            {blocker.label}
          </span>
          <Badge size="sm" variant="danger">
            {blocker.severity}
          </Badge>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{blocker.reason}</p>
      </div>
    </li>
  );
}

function NextActionItem({ action }: { action: PlacementNextAction }) {
  const icon = action.type === 'TRAINING' ? '📚' : action.type === 'SKILL' ? '⚡' : action.type === 'ASSESSMENT' ? '🧠' : action.type === 'OPPORTUNITY' ? '💼' : '🤝';
  return (
    <div className="flex items-start gap-2">
      <span className="text-sm leading-none mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            {action.title}
          </span>
          {action.ctaPath && (
            <Link to={action.ctaPath}>
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap">
                {action.ctaLabel ?? 'Go'}
              </span>
            </Link>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{action.reason}</p>
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────── */

interface PlacementReadinessCardProps {
  data?: PlacementReadiness;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Compact mode for embedding inside other pages (e.g. StudentCareerPlan). */
  compact?: boolean;
}

export function PlacementReadinessCard({
  data,
  isLoading,
  isError,
  onRetry,
  compact = false,
}: PlacementReadinessCardProps) {
  if (isError) return onRetry ? <ErrorState onRetry={onRetry} /> : <ErrorState />;
  if (isLoading) return <SkeletonCard />;

  if (!data || (data.overallScore === 0 && data.componentScores.length === 0)) {
    return (
      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <FiTarget /> Placement Readiness
          </h2>
        </Card.Header>
        <Card.Body>
          <EmptyState
            title="No readiness data yet"
            description="Build your profile to see your placement readiness score."
            action={
              <Link to="/student/skills">
                <button className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                  Add skills →
                </button>
              </Link>
            }
          />
        </Card.Body>
      </Card>
    );
  }

  const { overallScore, readinessLevel, readinessLabel, readinessDescription, componentScores, strengths, blockers, recommendedNextActions, insufficientData, insufficientReasons } = data;

  const tone = readinessColor(overallScore);
  const barColor = readinessBg(overallScore);

  return (
    <Card className={compact ? '' : ''}>
      <Card.Header>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <FiTarget /> Placement Readiness
          </h2>
          <div className="flex items-center gap-2">
            {insufficientData && (
              <Badge variant="warning" size="sm">Insufficient data</Badge>
            )}
            <Badge variant={readinessBadgeVariant(readinessLevel)}>
              {readinessLabel}
            </Badge>
          </div>
        </div>
      </Card.Header>

      <Card.Body className="space-y-5">
        {/* Overall score */}
        <div className="text-center py-2">
          <div className={`text-5xl font-bold tracking-tight mb-1 ${tone}`}>
            {overallScore}
          </div>
          <div className="text-sm text-slate-400 mb-3">/100</div>
          <ProgressBar value={overallScore} className="h-2" />
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            {readinessDescription}
          </p>
          {insufficientData && insufficientReasons[0] && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              {insufficientReasons[0]}
            </p>
          )}
        </div>

        {!compact && (
          <>
            {/* Component breakdown */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Score Breakdown
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {componentScores.map((comp) => (
                  <ComponentRow key={comp.key} comp={comp} />
                ))}
              </div>
            </div>

            {/* Two-column: strengths + blockers */}
            {(strengths.length > 0 || blockers.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {strengths.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-2">
                      Your Strengths
                    </h3>
                    <ul className="space-y-1.5">
                      {strengths.slice(0, 5).map((s) => (
                        <StrengthItem key={s.key} strength={s} />
                      ))}
                    </ul>
                  </div>
                )}
                {blockers.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide mb-2">
                      Blockers
                    </h3>
                    <ul className="space-y-1.5">
                      {blockers.slice(0, 5).map((b) => (
                        <BlockerItem key={b.key} blocker={b} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Next actions */}
            {recommendedNextActions.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide mb-2">
                  Recommended Next Steps
                </h3>
                <ol className="space-y-2">
                  {recommendedNextActions.slice(0, 5).map((action, i) => (
                    <li key={action.title} className="flex items-start gap-2">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-4 text-right shrink-0 mt-0.5">
                        {i + 1}.
                      </span>
                      <NextActionItem action={action} />
                    </li>
                  ))}
                </ol>
                <Link
                  to="/student/career-plan"
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline mt-3"
                >
                  View full action plan <FiArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
