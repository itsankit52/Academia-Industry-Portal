import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiStar, FiSearch } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import JobCard from '@/components/cards/JobCard';
import InternshipCard from '@/components/cards/InternshipCard';
import TrainingCard from '@/components/cards/TrainingCard';
import MatchBadge from '@/components/ui/MatchBadge';
import SkillChip from '@/components/ui/SkillChip';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  useRecommendations,
  type NamedSkill,
  type RecommendedInternship,
  type RecommendedJob,
} from '@/hooks/queries/useRecommendations';

/**
 * The matched/missing chips are shared by both opportunity types. Missing skills
 * link into the training catalogue filtered to that skill, which is the same
 * `?skill=<id>` contract the skill-gap page uses.
 */
function MatchSkills({ matched, missing }: { matched: NamedSkill[]; missing: NamedSkill[] }) {
  if (matched.length === 0 && missing.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
      {matched.map((s) => (
        <SkillChip
          key={s.id}
          name={s.name}
          className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
        />
      ))}
      {missing.map((s) => (
        <Link
          key={s.id}
          to={`/student/training?skill=${encodeURIComponent(s.id)}`}
          className="no-underline"
          title={`Find training for ${s.name}`}
        >
          <SkillChip
            name={s.name}
            className="bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 cursor-pointer hover:opacity-80"
          />
        </Link>
      ))}
    </div>
  );
}

function RecommendationShell({
  score,
  eligible,
  children,
  skills,
}: {
  score: number;
  eligible: boolean;
  children: ReactNode;
  skills: ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="shrink-0 flex flex-col items-end gap-1.5 mt-1">
          <MatchBadge score={score} />
          {/* Eligibility is decided server-side from CGPA, branch and grad year.
              Saying so up front beats letting the student discover it on submit. */}
          {!eligible && (
            <Badge variant="warning" size="sm">
              Not eligible
            </Badge>
          )}
        </div>
      </div>
      {skills}
    </div>
  );
}

function JobRecommendation({ item }: { item: RecommendedJob }) {
  return (
    <RecommendationShell
      score={item.matchResult.score}
      eligible={item.eligible}
      skills={<MatchSkills matched={item.matchedSkills} missing={item.missingSkills} />}
    >
      <JobCard job={item.job} linkPrefix="/student/jobs" />
    </RecommendationShell>
  );
}

function InternshipRecommendation({ item }: { item: RecommendedInternship }) {
  return (
    <RecommendationShell
      score={item.matchResult.score}
      eligible={item.eligible}
      skills={<MatchSkills matched={item.matchedSkills} missing={item.missingSkills} />}
    >
      <InternshipCard internship={item.internship} linkPrefix="/student/internships" />
    </RecommendationShell>
  );
}

const gridClass = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';

function Skeletons() {
  return (
    <div className={gridClass}>
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export default function StudentRecommended() {
  const [tab, setTab] = useState('jobs');

  const jobs = useRecommendations('jobs');
  const internships = useRecommendations('internships');
  const trainings = useRecommendations('trainings');

  // Every recommendation endpoint answers with a paginated envelope, so the
  // items live under `.items` — reading `.length` off the envelope itself is what
  // used to leave all three tabs permanently blank.
  const jobItems = jobs.data?.items ?? [];
  const internshipItems = internships.data?.items ?? [];
  const trainingItems = trainings.data?.items ?? [];

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Recommended" subtitle="Opportunities matched to your profile." />

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="jobs" label="Jobs" />
          <Tabs.Tab value="internships" label="Internships" />
          <Tabs.Tab value="trainings" label="Training" />
        </Tabs.List>

        <Tabs.Panels className="mt-6">
          <Tabs.Panel value="jobs">
            {jobs.isError && <ErrorState onRetry={() => void jobs.refetch()} />}
            {jobs.isLoading && <Skeletons />}
            {jobs.isSuccess && jobItems.length === 0 && (
              <EmptyState
                icon={<FiSearch />}
                title="No job recommendations"
                description="Complete your profile and skills to get matched."
              />
            )}
            {jobItems.length > 0 && (
              <div className={gridClass}>
                {jobItems.map((item) => (
                  <JobRecommendation key={item.job.id} item={item} />
                ))}
              </div>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="internships">
            {internships.isError && <ErrorState onRetry={() => void internships.refetch()} />}
            {internships.isLoading && <Skeletons />}
            {internships.isSuccess && internshipItems.length === 0 && (
              <EmptyState
                icon={<FiStar />}
                title="No internship recommendations"
                description="Complete your profile and skills to get matched."
              />
            )}
            {internshipItems.length > 0 && (
              <div className={gridClass}>
                {internshipItems.map((item) => (
                  <InternshipRecommendation key={item.internship.id} item={item} />
                ))}
              </div>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="trainings">
            {trainings.isError && <ErrorState onRetry={() => void trainings.refetch()} />}
            {trainings.isLoading && <Skeletons />}
            {trainings.isSuccess && trainingItems.length === 0 && (
              <EmptyState
                icon={<FiStar />}
                title="No training recommendations"
                description="Add skills to your profile to get training suggestions."
              />
            )}
            {trainingItems.length > 0 && (
              <div className={gridClass}>
                {trainingItems.map((item) => (
                  <TrainingCard key={item.training.id} training={item.training} />
                ))}
              </div>
            )}
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>
    </div>
  );
}
