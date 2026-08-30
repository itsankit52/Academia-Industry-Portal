/**
 * Phase 9B — Student Career Plan page.
 *
 * Renders the deterministic CareerActionPlan list for the student. The page
 * is the destination of the dashboard's "View action plan" CTA. It composes:
 *   - useCareerActionPlan (GET /recommendations/me/action-plan)
 *   - usePersonalizedRecommendations (for the career insights context)
 *   - usePlacementReadiness (Phase 10 — detailed readiness breakdown)
 *   - usePlacementOutcomes (Phase 10 — application outcome funnel)
 *
 * Reuses existing UI primitives and never fabricates actions: every action
 * has a real CTA path that comes from the API.
 */

import { FiTarget, FiTrendingUp } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import { CareerActionPlanCard } from '@/components/recommendations/CareerActionPlanCard';
import { PlacementReadinessCard } from '@/components/placement/PlacementReadinessCard';
import { OutcomeFunnel } from '@/components/placement/OutcomeFunnel';
import { useCareerActionPlan } from '@/hooks/queries/useCareerActionPlan';
import { usePersonalizedRecommendations } from '@/hooks/queries/usePersonalizedRecommendations';
import { usePlacementReadiness } from '@/hooks/queries/usePlacementReadiness';
import { usePlacementOutcomes } from '@/hooks/queries/usePlacementOutcomes';

export default function StudentCareerPlan() {
  const { data, isLoading, isError, refetch } = useCareerActionPlan();
  const { data: personalized } = usePersonalizedRecommendations();
  // Phase 10 — detailed placement intelligence
  const { data: readiness, isLoading: readinessLoading, isError: readinessError, refetch: refetchReadiness } =
    usePlacementReadiness();
  const { data: outcomes, isLoading: outcomesLoading, isError: outcomesError, refetch: refetchOutcomes } =
    usePlacementOutcomes();

  const readinessCtx = personalized?.readiness;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Your Career Action Plan"
        subtitle="A prioritized roadmap to close your skill gaps, get verified, and land your target role."
      />

      {/* Readiness context */}
      {readinessCtx && (
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                <FiTarget /> Current Readiness
              </h2>
              <Badge variant={readinessCtx.readinessScore >= 60 ? 'success' : 'warning'}>
                {readinessCtx.level}
              </Badge>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="flex items-end gap-3 mb-2">
              <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {readinessCtx.readinessScore}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400 mb-1">/100</span>
            </div>
            <ProgressBar value={readinessCtx.readinessScore} className="mb-3" />
            <p className="text-sm text-slate-600 dark:text-slate-300">{readinessCtx.description}</p>
          </Card.Body>
        </Card>
      )}

      {/* Phase 10 — Detailed placement readiness breakdown */}
      <PlacementReadinessCard
        data={readiness}
        isLoading={readinessLoading}
        isError={readinessError}
        onRetry={() => void refetchReadiness()}
      />

      {/* Phase 10 — Application outcome funnel */}
      <OutcomeFunnel
        data={outcomes}
        isLoading={outcomesLoading}
        isError={outcomesError}
        onRetry={() => void refetchOutcomes()}
        variant="student"
      />

      {/* Top priorities (from Phase 9A) */}
      {personalized && personalized.skillGaps.length > 0 && (
        <Card>
          <Card.Header>
            <h2 className="text-sm font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
              <FiTrendingUp /> Top Skill Priorities
            </h2>
          </Card.Header>
          <Card.Body>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              These are the highest-leverage skills to focus on. Each row is sourced from
              industry demand and your existing profile.
            </p>
            <ol className="space-y-2">
              {personalized.skillGaps.slice(0, 5).map((gap, i) => (
                <li
                  key={gap.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                        #{i + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {gap.name}
                      </span>
                      <Badge size="sm">{gap.priority}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {gap.reason}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                    {gap.demandScore}× demand
                  </span>
                </li>
              ))}
            </ol>
          </Card.Body>
        </Card>
      )}

      {/* Action plan */}
      <CareerActionPlanCard
        actions={data?.actions ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
      />
    </div>
  );
}
