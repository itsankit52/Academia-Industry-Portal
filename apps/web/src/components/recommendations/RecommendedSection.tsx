/**
 * Phase 9A — "Recommended For You" section for the student dashboard.
 *
 * Reuses existing UI components (Card, Badge, SkillChip, Button, EmptyState, ErrorState)
 * and the existing design system (Tailwind + dark mode).
 */

import { FiTarget, FiBookOpen, FiUsers, FiBriefcase, FiStar, FiTrendingUp } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  usePersonalizedRecommendations,
  type PersonalizedRecommendations,
} from '@/hooks/queries/usePersonalizedRecommendations';

function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case 'CRITICAL':
      return <Badge variant="danger">Critical</Badge>;
    case 'HIGH':
      return <Badge variant="warning">High</Badge>;
    case 'MEDIUM':
      return <Badge variant="info">Medium</Badge>;
    default:
      return <Badge>Low</Badge>;
  }
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

function SkillGapRow({ gap }: { gap: PersonalizedRecommendations['skillGaps'][0] }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{gap.name}</span>
          <PriorityBadge priority={gap.priority} />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{gap.reason}</p>
      </div>
      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
        {gap.demandScore}× demand
      </span>
    </div>
  );
}

function TrainingRow({ training }: { training: PersonalizedRecommendations['trainings'][0] }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{training.title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {training.provider} · {training.durationWeeks}w
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 tabular-nums">
          {training.overlapCount} gap skill{training.overlapCount !== 1 ? 's' : ''}
        </span>
        <a href={training.registrationUrl} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline">
            Enroll
          </Button>
        </a>
      </div>
    </div>
  );
}

function MentorRow({ mentor }: { mentor: PersonalizedRecommendations['mentors'][0] }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {mentor.fullName}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {mentor.expertise.slice(0, 2).join(', ')}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
          {mentor.reasons[0] ?? `${mentor.score} score`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 tabular-nums">
          {mentor.score.toFixed(0)}
        </span>
        <Link to="/student/mentorship">
          <Button size="sm" variant="outline">
            Connect
          </Button>
        </Link>
      </div>
    </div>
  );
}

function OpportunityRow({
  opp,
}: {
  opp: PersonalizedRecommendations['jobs'][0] | PersonalizedRecommendations['internships'][0];
}) {
  const isJob = opp.type === 'JOB';
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
            {opp.title}
          </span>
          {opp.companyName && (
            <span className="text-xs text-slate-500 dark:text-slate-400">{opp.companyName}</span>
          )}
          {!opp.eligible && (
            <Badge variant="warning" size="sm">
              Ineligible
            </Badge>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opp.matchSummary}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-medium tabular-nums text-indigo-600 dark:text-indigo-400">
          {opp.matchScore}
        </span>
        <Link to={isJob ? `/jobs/${opp.id}` : `/internships/${opp.id}`}>
          <Button size="sm" variant="outline">
            View
          </Button>
        </Link>
      </div>
    </div>
  );
}

interface RecommendedSectionProps {
  onRetry: () => void;
}

export function RecommendedSection({ onRetry }: RecommendedSectionProps) {
  const { data, isLoading, isError } = usePersonalizedRecommendations();

  if (isError) return <ErrorState onRetry={onRetry} />;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!data) return null;

  const hasGaps = data.skillGaps.length > 0;
  const hasTrainings = data.trainings.length > 0;
  const hasMentors = data.mentors.length > 0;
  const hasOpportunities = data.jobs.length > 0 || data.internships.length > 0;
  const hasContent = hasGaps || hasTrainings || hasMentors || hasOpportunities;

  if (!hasContent) {
    return (
      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <FiTarget /> Recommended For You
          </h2>
        </Card.Header>
        <Card.Body>
          <EmptyState
            icon={<FiStar />}
            title="No recommendations yet"
            description="Add skills, browse training, and complete assessments to unlock personalized recommendations."
            action={
              <div className="flex gap-2">
                <Link to="/student/skills">
                  <Button size="sm">Add Skills</Button>
                </Link>
                <Link to="/student/training">
                  <Button size="sm" variant="outline">
                    Browse Training
                  </Button>
                </Link>
              </div>
            }
          />
        </Card.Body>
      </Card>
    );
  }

  return (
    <div>
      {/* Readiness bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <FiTarget /> Recommended For You
          </h2>
          <ReadinessBadge level={data.readiness.level} />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {data.readiness.description}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Skill Gaps */}
        <Card>
          <Card.Header>
            <h3 className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
              <FiTrendingUp /> Skill Priorities
            </h3>
          </Card.Header>
          <Card.Body className="p-0">
            {hasGaps ? (
              <div className="px-4">
                {data.skillGaps.slice(0, 4).map((gap) => (
                  <SkillGapRow key={gap.id} gap={gap} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 px-4 py-3">
                No skill gaps detected.
              </p>
            )}
            <Card.Footer>
              <Link
                to="/student/skill-profile"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View full profile →
              </Link>
            </Card.Footer>
          </Card.Body>
        </Card>

        {/* Trainings */}
        <Card>
          <Card.Header>
            <h3 className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
              <FiBookOpen /> Training
            </h3>
          </Card.Header>
          <Card.Body className="p-0">
            {hasTrainings ? (
              <div className="px-4">
                {data.trainings.slice(0, 3).map((t) => (
                  <TrainingRow key={t.id} training={t} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 px-4 py-3">
                No matching training found.
              </p>
            )}
            <Card.Footer>
              <Link
                to="/student/training"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Browse all training →
              </Link>
            </Card.Footer>
          </Card.Body>
        </Card>

        {/* Mentors */}
        <Card>
          <Card.Header>
            <h3 className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wide flex items-center gap-1.5">
              <FiUsers /> Mentors
            </h3>
          </Card.Header>
          <Card.Body className="p-0">
            {hasMentors ? (
              <div className="px-4">
                {data.mentors.slice(0, 3).map((m) => (
                  <MentorRow key={m.id} mentor={m} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 px-4 py-3">
                No mentors available.
              </p>
            )}
            <Card.Footer>
              <Link
                to="/student/mentorship"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Find a mentor →
              </Link>
            </Card.Footer>
          </Card.Body>
        </Card>

        {/* Opportunities */}
        <Card>
          <Card.Header>
            <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
              <FiBriefcase /> Opportunities
            </h3>
          </Card.Header>
          <Card.Body className="p-0">
            {hasOpportunities ? (
              <div className="px-4">
                {data.jobs.slice(0, 2).map((j) => (
                  <OpportunityRow key={j.id} opp={j} />
                ))}
                {data.internships.slice(0, 2).map((i) => (
                  <OpportunityRow key={i.id} opp={i} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 px-4 py-3">
                No matching opportunities.
              </p>
            )}
            <Card.Footer>
              <div className="flex gap-3">
                <Link
                  to="/jobs"
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Browse jobs →
                </Link>
                <Link
                  to="/internships"
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Internships →
                </Link>
              </div>
            </Card.Footer>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
