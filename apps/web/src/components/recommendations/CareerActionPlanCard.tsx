/**
 * Phase 9B — Career Action Plan card.
 *
 * Renders the deterministic CareerActionPlan list. Each action has a real
 * CTA path when one exists; the action is only displayed when the type
 * can be acted on. Reuses the existing Card, Badge, Button, and EmptyState
 * UI primitives.
 */

import { FiZap, FiBookOpen, FiUsers, FiBriefcase, FiPlusCircle, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { CareerAction, CareerActionType } from '@aip/types';

interface CareerActionPlanCardProps {
  actions: CareerAction[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** When set, shows the action plan context (e.g. "for Backend Developer"). */
  contextLabel?: string;
}

function actionIcon(type: CareerActionType) {
  switch (type) {
    case 'TRAINING':
      return <FiBookOpen />;
    case 'ASSESSMENT':
      return <FiZap />;
    case 'MENTOR':
      return <FiUsers />;
    case 'OPPORTUNITY':
      return <FiBriefcase />;
    case 'SKILL':
    default:
      return <FiPlusCircle />;
  }
}

function actionLabel(type: CareerActionType) {
  switch (type) {
    case 'TRAINING':
      return 'Training';
    case 'ASSESSMENT':
      return 'Assessment';
    case 'MENTOR':
      return 'Mentor';
    case 'OPPORTUNITY':
      return 'Opportunity';
    case 'SKILL':
      return 'Add skill';
    default:
      return 'Action';
  }
}

function ActionRow({ action }: { action: CareerAction }) {
  const ctaPath = action.ctaPath;
  return (
    <li className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span
        className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm"
        aria-hidden="true"
      >
        {actionIcon(action.type)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
            #{action.priority}
          </span>
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {action.title}
          </span>
          <Badge size="sm">{actionLabel(action.type)}</Badge>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
          {action.reason}
        </p>
      </div>
      {ctaPath && (
        <Link to={ctaPath} className="shrink-0">
          <Button size="sm" variant="outline" iconRight={<FiArrowRight />}>
            {action.ctaLabel ?? 'Take action'}
          </Button>
        </Link>
      )}
    </li>
  );
}

export function CareerActionPlanCard({
  actions,
  isLoading,
  isError,
  onRetry,
  contextLabel,
}: CareerActionPlanCardProps) {
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (isLoading) return <SkeletonCard />;

  if (actions.length === 0) {
    return (
      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <FiCheckCircle /> Your Action Plan
          </h2>
        </Card.Header>
        <Card.Body>
          <EmptyState
            title="Your action plan is empty"
            description="Add a few skills, take an assessment, or set a target opportunity to receive personalized next steps."
            action={
              <Link to="/student/skills">
                <Button size="sm">Add Skills</Button>
              </Link>
            }
          />
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
          <FiCheckCircle /> Your Action Plan
          {contextLabel && (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">
              for {contextLabel}
            </span>
          )}
        </h2>
      </Card.Header>
      <Card.Body>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Prioritized steps. Each step is sourced from your real skill, training,
          and assessment data.
        </p>
        <ol className="space-y-0">
          {actions.map((a) => (
            <ActionRow key={`${a.priority}-${a.type}-${a.entityId ?? a.title}`} action={a} />
          ))}
        </ol>
      </Card.Body>
    </Card>
  );
}
