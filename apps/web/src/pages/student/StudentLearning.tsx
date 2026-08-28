import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiAward,
  FiBookOpen,
  FiExternalLink,
  FiFilter,
  FiMapPin,
  FiStar,
  FiTarget,
  FiTrendingUp,
  FiUser,
} from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import SkillChip from '@/components/ui/SkillChip';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import Tabs from '@/components/ui/Tabs';
import { useLearningRecommendations } from '@/hooks/queries/useLearningRecommendations';
import { useJobs } from '@/hooks/queries/useJobs';
import { useInternships } from '@/hooks/queries/useInternships';
import { format } from 'date-fns';

const opportunityTypeOptions = [
  { value: 'JOB', label: 'Job' },
  { value: 'INTERNSHIP', label: 'Internship' },
];

function MentorCard({
  mentor,
  expertiseMatch,
}: {
  mentor: {
    id: string;
    userId?: string;
    fullName?: string;
    expertise: string[];
    availability: string;
    bio?: string;
    yearsExperience?: number;
  };
  expertiseMatch: string[];
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center dark:bg-indigo-900/40">
            <FiUser className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
              {mentor.fullName ?? 'Mentor'}
            </h3>
            {mentor.yearsExperience !== undefined && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mentor.yearsExperience} yrs experience
              </p>
            )}
          </div>
        </div>
        <Badge
          variant={mentor.availability === 'AVAILABLE' ? 'success' : 'warning'}
          size="sm"
          className="shrink-0"
        >
          {mentor.availability}
        </Badge>
      </div>

      {mentor.bio && (
        <p className="text-xs text-slate-600 line-clamp-2 mb-3 dark:text-slate-400">{mentor.bio}</p>
      )}

      {expertiseMatch.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {expertiseMatch.slice(0, 4).map((skill) => (
            <SkillChip
              key={skill}
              name={skill}
              className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
            />
          ))}
          {expertiseMatch.length > 4 && (
            <span className="text-xs text-slate-400 self-center dark:text-slate-500">
              +{expertiseMatch.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <Link
          to="/student/mentorship"
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium no-underline dark:text-indigo-400"
        >
          Request mentorship <FiExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

function WorkshopCard({
  event,
  tagMatch,
}: {
  event: {
    id: string;
    title: string;
    eventType: string;
    startAt: string;
    location?: string;
    mode: string;
    description: string;
    tags: string[];
    registrationDeadline?: string;
  };
  tagMatch: string[];
  tagMatchCount: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="default" size="sm">
              {event.eventType}
            </Badge>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {format(new Date(event.startAt), 'MMM d, yyyy')}
            </span>
          </div>
          <h3 className="font-semibold text-sm text-slate-900 leading-tight dark:text-slate-100">
            {event.title}
          </h3>
        </div>
      </div>

      <p className="text-xs text-slate-600 line-clamp-2 mb-3 dark:text-slate-400">
        {event.description}
      </p>

      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3 dark:text-slate-400">
        {event.location && (
          <span className="flex items-center gap-1">
            <FiMapPin className="w-3.5 h-3.5" />
            {event.location}
          </span>
        )}
        <span>{event.mode}</span>
      </div>

      {tagMatch.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tagMatch.slice(0, 4).map((tag) => (
            <SkillChip
              key={tag}
              name={tag}
              className="bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <Link
          to="/student/events"
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium no-underline dark:text-indigo-400"
        >
          View event <FiExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

export default function StudentLearning() {
  const [targetType, setTargetType] = useState<'JOB' | 'INTERNSHIP'>('JOB');
  const [targetId, setTargetId] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showOpportunityFilter, setShowOpportunityFilter] = useState(false);

  const jobs = useJobs({ status: 'PUBLISHED', pageSize: 100 });
  const internships = useInternships({ status: 'PUBLISHED', pageSize: 100 });

  const opportunityOptions =
    targetType === 'JOB'
      ? [
          { value: '', label: 'All opportunities' },
          ...(jobs.data?.items.map((j) => ({ value: j.id, label: j.title })) ?? []),
        ]
      : [
          { value: '', label: 'All opportunities' },
          ...(internships.data?.items.map((i) => ({ value: i.id, label: i.title })) ?? []),
        ];

  const params = targetId
    ? { targetOpportunityId: targetId, targetOpportunityType: targetType }
    : undefined;

  const { data, isLoading, isError, refetch } = useLearningRecommendations(params);

  const hasItems =
    (data?.trainings.length ?? 0) > 0 ||
    (data?.mentors.length ?? 0) > 0 ||
    (data?.workshops.length ?? 0) > 0;

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'trainings', label: 'Training' },
    { id: 'mentors', label: 'Mentors' },
    { id: 'workshops', label: 'Workshops' },
  ];

  const visibleTrainings =
    activeTab === 'all' || activeTab === 'trainings' ? (data?.trainings ?? []) : [];
  const visibleMentors =
    activeTab === 'all' || activeTab === 'mentors' ? (data?.mentors ?? []) : [];
  const visibleWorkshops =
    activeTab === 'all' || activeTab === 'workshops' ? (data?.workshops ?? []) : [];

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Learning & Training"
        subtitle="Personalised recommendations to close your skill gaps."
      />

      {/* Opportunity filter */}
      <Card>
        <Card.Body className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => setShowOpportunityFilter((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors no-underline ${
                showOpportunityFilter || targetId
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300'
                  : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              <FiFilter className="w-3.5 h-3.5" />
              {targetId ? 'Targeting opportunity' : 'Filter by opportunity'}
            </button>
            {targetId && (
              <button
                onClick={() => setTargetId('')}
                className="text-xs text-rose-500 hover:text-rose-600 font-medium"
              >
                Clear
              </button>
            )}
          </div>

          {showOpportunityFilter && (
            <div className="flex flex-wrap gap-3 w-full">
              <div className="flex gap-2">
                {opportunityTypeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setTargetType(opt.value as 'JOB' | 'INTERNSHIP');
                      setTargetId('');
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      targetType === opt.value
                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {opportunityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Missing skills */}
      {data && data.missingSkills.length > 0 && (
        <Card>
          <Card.Header>
            <div className="flex items-center gap-2">
              <FiTarget className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Skills to Develop ({data.missingSkills.length})
              </h2>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="flex flex-wrap gap-2">
              {data.missingSkills.map((skill) => (
                <Link
                  key={skill.id}
                  to={`/student/training?skill=${encodeURIComponent(skill.name)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors no-underline"
                >
                  <FiTrendingUp className="w-3 h-3" />
                  {skill.name}
                  <Badge variant="default" size="sm" className="text-xs">
                    {skill.category}
                  </Badge>
                </Link>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Content */}
      {isLoading && <SkeletonCard />}

      {isError && (
        <ErrorState
          title="Could not load recommendations"
          description="Please try again."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && !hasItems && (
        <EmptyState
          icon={<FiAward />}
          title="No recommendations yet"
          description={
            data?.missingSkills.length === 0
              ? 'Add skills to your profile to get personalised training recommendations.'
              : 'No matching training programmes, mentors, or workshops were found for your skill gaps.'
          }
        />
      )}

      {!isLoading && !isError && hasItems && (
        <>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              {tabs.map((t) => (
                <Tabs.Tab key={t.id} value={t.id} label={t.label} />
              ))}
            </Tabs.List>
          </Tabs>

          {/* Trainings */}
          {visibleTrainings.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FiBookOpen className="w-4 h-4 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Training Programmes ({visibleTrainings.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleTrainings.map((item) => (
                  <div key={item.training.id} className="relative">
                    <a
                      href={item.training.registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow dark:bg-slate-900 dark:border-slate-800 no-underline"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm text-slate-900 leading-tight dark:text-slate-100">
                            {item.training.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
                            {item.training.provider}
                          </p>
                        </div>
                        <Badge variant="success" size="sm" className="shrink-0">
                          Active
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 mb-3 dark:text-slate-400">
                        {item.training.description}
                      </p>
                      {item.training.skills.slice(0, 3).map((s) => (
                        <SkillChip key={s.id} name={s.name} />
                      ))}
                      {item.training.skills.length > 3 && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          +{item.training.skills.length - 3}
                        </span>
                      )}
                    </a>
                    {item.overlapCount > 0 && (
                      <div className="absolute top-3 right-3">
                        <Badge variant="info" size="sm">
                          {item.overlapCount} relevant skill{item.overlapCount > 1 ? 's' : ''}
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mentors */}
          {visibleMentors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FiUser className="w-4 h-4 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Recommended Mentors ({visibleMentors.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleMentors.map((item) => (
                  <MentorCard
                    key={item.mentor.id}
                    mentor={item.mentor as Parameters<typeof MentorCard>[0]['mentor']}
                    expertiseMatch={item.expertiseMatch}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Workshops */}
          {visibleWorkshops.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FiStar className="w-4 h-4 text-amber-500" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Workshops & Events ({visibleWorkshops.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleWorkshops.map((item) => (
                  <WorkshopCard
                    key={item.event.id}
                    event={item.event as Parameters<typeof WorkshopCard>[0]['event']}
                    tagMatch={item.tagMatch}
                    tagMatchCount={item.tagMatchCount}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
