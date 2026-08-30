/**
 * Phase 10 — Outcome funnel component.
 *
 * Renders the application→shortlisted→interview→selected→accepted funnel
 * using existing application lifecycle data. Reads from the placement
 * outcomes hook payload.
 */

import { FiTrendingUp, FiUsers } from 'react-icons/fi';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import type { PlacementOutcomes, InstitutionOutcomeMetrics, OutcomeCategory } from '@aip/types';

interface OutcomeFunnelProps {
  data?: PlacementOutcomes | InstitutionOutcomeMetrics;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  title?: string;
  /** Student context (single applicant) vs institution cohort. */
  variant?: 'student' | 'institution';
}

function categoryLabel(cat: OutcomeCategory): string {
  switch (cat) {
    case 'APPLIED': return 'Applications';
    case 'SHORTLISTED': return 'Shortlisted';
    case 'INTERVIEW': return 'Interview';
    case 'SELECTED': return 'Selected';
    case 'OFFER_ACCEPTED': return 'Accepted';
    default: return cat;
  }
}

function stepColor(idx: number): string {
  const colors = [
    'bg-indigo-500',
    'bg-sky-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-emerald-600',
  ];
  return colors[idx] ?? 'bg-slate-500';
}

export function OutcomeFunnel({
  data,
  isLoading,
  isError,
  onRetry,
  title = 'Application Funnel',
  variant = 'student',
}: OutcomeFunnelProps) {
  if (isError) return onRetry ? <ErrorState onRetry={onRetry} /> : <ErrorState />;
  if (isLoading) return <SkeletonCard />;
  if (!data) return null;

  const funnel = data.funnel ?? [];
  if (funnel.length === 0 || data.totalApplications === 0) {
    return (
      <Card>
        <Card.Header>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <FiTrendingUp /> {title}
          </h3>
        </Card.Header>
        <Card.Body>
          <EmptyState
            icon={<FiUsers />}
            title="No application data yet"
            description={
              variant === 'student'
                ? 'Submit your first application to start building your funnel.'
                : 'No applications on file for this cohort.'
            }
          />
        </Card.Body>
      </Card>
    );
  }

  // Compute widths: the first step (Applications) is 100%, others scale
  // relative to it.
  const topCount = funnel[0]?.count ?? 1;
  const widthPct = (n: number) => (topCount > 0 ? Math.max(2, (n / topCount) * 100) : 2);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
          <FiTrendingUp /> {title}
        </h3>
      </CardHeader>
      <CardBody>
        <div className="space-y-3">
          {funnel.map((step, idx) => (
            <div key={step.category} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {categoryLabel(step.category)}
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                  {step.count}
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${stepColor(idx)} rounded-full transition-all`}
                  style={{ width: `${widthPct(step.count)}%` }}
                />
              </div>
              {idx > 0 && funnel[idx - 1] && funnel[idx - 1]!.count > 0 && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {Math.round((step.count / funnel[idx - 1]!.count) * 100)}% from previous step
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Quick metrics row */}
        <div className="mt-5 grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Success Rate</p>
            <p className="text-base font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {data.successRate.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Interview Rate</p>
            <p className="text-base font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {data.interviewRate.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Selection Rate</p>
            <p className="text-base font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {data.selectionRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
