/**
 * Phase 10 — Institution Interventions Panel.
 *
 * Renders the deterministic intervention list (CRITICAL/HIGH/MEDIUM/LOW) for
 * the institution, with severity filters. Each row shows the student, their
 * current readiness level, the intervention type, and a recommended action.
 *
 * Reuses Card, Badge, Button, EmptyState, ErrorState, Skeleton primitives.
 */

import { useState, useMemo } from 'react';
import { FiAlertTriangle, FiFilter } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { SEVERITY_ORDER } from '@aip/types';
import type { InstitutionInterventions, InterventionSeverity, StudentIntervention } from '@aip/types';

interface InstitutionInterventionsPanelProps {
  data?: InstitutionInterventions;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const SEVERITY_BADGE: Record<InterventionSeverity, 'danger' | 'warning' | 'info' | 'default'> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'default',
};

const SEVERITY_TONE: Record<InterventionSeverity, string> = {
  CRITICAL: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
  HIGH: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  MEDIUM: 'text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800',
  LOW: 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
};

function InterventionRow({ intervention }: { intervention: StudentIntervention }) {
  return (
    <li
      className={`p-3 rounded-lg border ${SEVERITY_TONE[intervention.severity]} space-y-1.5`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {intervention.studentName}
          </span>
          {intervention.branch && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              · {intervention.branch}
            </span>
          )}
          <Badge size="sm" variant={SEVERITY_BADGE[intervention.severity]}>
            {intervention.severity}
          </Badge>
          <Badge size="sm">{intervention.interventionType.replace(/_/g, ' ')}</Badge>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
          Score {intervention.readinessScore}/100
        </span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300">
        <span className="font-medium text-slate-700 dark:text-slate-200">Why:</span>{' '}
        {intervention.reason}
      </p>
      <p className="text-xs text-slate-600 dark:text-slate-300">
        <span className="font-medium text-slate-700 dark:text-slate-200">Action:</span>{' '}
        {intervention.recommendedAction}
      </p>
    </li>
  );
}

export function InstitutionInterventionsPanel({
  data,
  isLoading,
  isError,
  onRetry,
}: InstitutionInterventionsPanelProps) {
  const [severityFilter, setSeverityFilter] = useState<InterventionSeverity | 'ALL'>('ALL');

  if (isError) return onRetry ? <ErrorState onRetry={onRetry} /> : <ErrorState />;
  if (isLoading) return <SkeletonCard />;

  const allInterventions = data?.interventions ?? [];

  const filtered = useMemo(() => {
    if (severityFilter === 'ALL') return allInterventions;
    return allInterventions.filter((i) => i.severity === severityFilter);
  }, [allInterventions, severityFilter]);

  if (!data || data.totalStudents === 0) {
    return (
      <Card>
        <Card.Header>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <FiAlertTriangle /> Interventions
          </h3>
        </Card.Header>
        <Card.Body>
          <EmptyState
            title="No students yet"
            description="Once students are linked to this institution, interventions will be detected automatically based on placement readiness signals."
          />
        </Card.Body>
      </Card>
    );
  }

  if (allInterventions.length === 0) {
    return (
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <FiAlertTriangle /> Interventions
            </h3>
            <Badge variant="success">All clear</Badge>
          </div>
        </Card.Header>
        <Card.Body>
          <EmptyState
            title="No interventions needed"
            description={`All ${data.totalStudents} students in this cohort are on track. The detector runs on every readiness refresh.`}
          />
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <FiAlertTriangle /> Interventions
            </h3>
            <Badge size="sm">
              {data.flaggedCount} of {data.totalStudents} flagged
            </Badge>
          </div>

          {/* Severity summary + filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <FiFilter className="w-3 h-3" /> Filter:
            </span>
            <Button
              size="sm"
              variant={severityFilter === 'ALL' ? 'primary' : 'outline'}
              onClick={() => setSeverityFilter('ALL')}
            >
              All
            </Button>
            {SEVERITY_ORDER.map((sev) => {
              const count = data.bySeverity?.[sev] ?? 0;
              if (count === 0) return null;
              return (
                <Button
                  key={sev}
                  size="sm"
                  variant={severityFilter === sev ? 'primary' : 'outline'}
                  onClick={() => setSeverityFilter(sev)}
                >
                  {sev} ({count})
                </Button>
              );
            })}
          </div>
        </div>
      </Card.Header>
      <Card.Body>
        {filtered.length === 0 ? (
          <EmptyState
            title={`No ${severityFilter} interventions`}
            description="No students currently match this severity band. Try a different filter."
          />
        ) : (
          <ul className="space-y-2">
            {filtered.map((intervention, idx) => (
              <InterventionRow
                key={`${intervention.studentUserId}-${intervention.interventionType}-${idx}`}
                intervention={intervention}
              />
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}

export default InstitutionInterventionsPanel;
