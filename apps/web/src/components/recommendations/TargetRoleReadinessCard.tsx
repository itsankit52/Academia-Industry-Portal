/**
 * Phase 9B — Target Role / Opportunity Readiness card.
 *
 * Renders a deterministic, explainable readiness analysis for a single
 * opportunity. Reuses the existing Card / Badge / Button / SkillChip UI
 * primitives and never exposes employer-private information.
 *
 * Composes:
 *   - useCareerPathAnalysis (GET /recommendations/me/career-path/:type/:id)
 *   - useCareerActionPlan  (for the action list)
 */

import { FiTarget, FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiArrowRight } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import SkillChip from '@/components/ui/SkillChip';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { CareerPathAnalysis, SkillComparison } from '@aip/types';
import type { OpportunityType } from '@aip/config';

interface TargetRoleReadinessCardProps {
  type: OpportunityType;
  id: string;
  data?: CareerPathAnalysis;
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

function stateBadge(state: SkillComparison['state']) {
  if (state === 'MATCHED') return <Badge variant="success" size="sm">Matched</Badge>;
  if (state === 'PARTIAL') return <Badge variant="warning" size="sm">Partial</Badge>;
  return <Badge variant="danger" size="sm">Missing</Badge>;
}

function SkillRow({ comparison }: { comparison: SkillComparison }) {
  return (
    <li className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="min-w-0 flex items-center gap-2">
        <SkillChip
          name={comparison.name}
          proficiency={comparison.currentProficiency ?? undefined}
        />
        {stateBadge(comparison.state)}
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
        {comparison.currentProficiency ?? '—'} → {comparison.requiredProficiency}
      </span>
    </li>
  );
}

export function TargetRoleReadinessCard({
  type,
  id,
  data,
  isLoading,
  isError,
  onRetry,
}: TargetRoleReadinessCardProps) {
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (isLoading) return <SkeletonCard />;
  if (!data) return null;

  const { readiness, skillComparison, nextActions, highestPriorityGaps } = data;
  const recommendedActions = readiness.recommendedActions;
  const matched = skillComparison.filter((c) => c.state === 'MATCHED');
  const partial = skillComparison.filter((c) => c.state === 'PARTIAL');
  const missing = skillComparison.filter((c) => c.state === 'MISSING');
  const tone = readinessTone(readiness.readinessScore);

  return (
    <Card>
      <Card.Header>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
          <FiTarget /> Readiness for {data.opportunity.title}
        </h2>
      </Card.Header>
      <Card.Body className="space-y-5">
        {/* Score block */}
        <div>
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Match Score
              </p>
              <p className={`text-3xl font-bold tracking-tight ${tone.ring}`}>
                {readiness.readinessScore}/100
              </p>
            </div>
            {readiness.eligible ? (
              <Badge variant="success">Eligible</Badge>
            ) : (
              <Badge variant="warning">Eligibility issues</Badge>
            )}
          </div>
          <ProgressBar value={readiness.readinessScore} className="mt-1" />
          <p className="text-sm text-slate-700 dark:text-slate-200 mt-2">{readiness.headline}</p>
        </div>

        {/* Skill buckets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <FiCheckCircle className="w-3.5 h-3.5" /> Matched ({matched.length})
            </p>
            {matched.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">No matches yet.</p>
            ) : (
              <ul>
                {matched.slice(0, 4).map((c) => (
                  <SkillRow key={c.skillId} comparison={c} />
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <FiAlertTriangle className="w-3.5 h-3.5" /> Partial ({partial.length})
            </p>
            {partial.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">No partials.</p>
            ) : (
              <ul>
                {partial.slice(0, 4).map((c) => (
                  <SkillRow key={c.skillId} comparison={c} />
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <FiAlertCircle className="w-3.5 h-3.5" /> Missing ({missing.length})
            </p>
            {missing.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">No missing.</p>
            ) : (
              <ul>
                {missing.slice(0, 4).map((c) => (
                  <SkillRow key={c.skillId} comparison={c} />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Top gaps */}
        {highestPriorityGaps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
              Highest-priority gaps
            </p>
            <div className="flex flex-wrap gap-1.5">
              {highestPriorityGaps.map((g) => (
                <SkillChip
                  key={g.skillId}
                  name={g.name}
                  className="bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                />
              ))}
            </div>
          </div>
        )}

        {/* Next actions */}
        {recommendedActions.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2">
              Recommended next steps
            </p>
            <ol className="space-y-2">
              {recommendedActions.slice(0, 4).map((a, idx) => (
                <li key={`${a.type}-${a.title}`} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      <span className="text-xs text-slate-400 dark:text-slate-500 mr-1 tabular-nums">
                        {idx + 1}.
                      </span>
                      {a.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{a.reason}</p>
                  </div>
                  {a.ctaPath && (
                    <Link to={a.ctaPath} className="shrink-0">
                      <Button size="sm" variant="outline" iconRight={<FiArrowRight />}>
                        {a.ctaLabel ?? 'Open'}
                      </Button>
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* View full */}
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Analysis based on your {data.skillComparison.length} compared skills.
        </div>
      </Card.Body>
      <Card.Footer>
        <Link
          to={type === 'JOB' ? `/jobs/${id}` : `/internships/${id}`}
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          View {type === 'JOB' ? 'job' : 'internship'} →
        </Link>
      </Card.Footer>
    </Card>
  );
}
