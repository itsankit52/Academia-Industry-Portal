import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiSearch,
  FiTarget,
  FiTrendingUp,
  FiBookOpen,
  FiZap,
  FiCheckCircle,
  FiAlertCircle,
} from 'react-icons/fi';
import type { Proficiency } from '@aip/config';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import MatchBadge from '@/components/ui/MatchBadge';
import SkillChip from '@/components/ui/SkillChip';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useSkillGap } from '@/hooks/queries/useSkillGap';
import { useFullMatch, type FullMatchAnalysis } from '@/hooks/queries/useFullMatch';
import { useJobs } from '@/hooks/queries/useJobs';
import { useInternships } from '@/hooks/queries/useInternships';

const opportunityTypeOptions = [
  { value: 'JOB', label: 'Job' },
  { value: 'INTERNSHIP', label: 'Internship' },
];

const PROFICIENCY_LABEL: Record<Proficiency, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

const BREAKDOWN_LABELS: Record<string, string> = {
  technical: 'Skill Match',
  proficiency: 'Proficiency',
  soft: 'Soft Skills',
  career: 'Career Alignment',
  industryDemand: 'Industry Demand',
  eligibility: 'Eligibility',
};

export default function StudentSkillGap() {
  const [opportunityType, setOpportunityType] = useState<'JOB' | 'INTERNSHIP'>('JOB');
  const [opportunityId, setOpportunityId] = useState('');

  const skillGap = useSkillGap();
  const fullMatch = useFullMatch(opportunityType, opportunityId);
  const jobs = useJobs({ status: 'PUBLISHED', pageSize: 100 });
  const internships = useInternships({ status: 'PUBLISHED', pageSize: 100 });

  const opportunityOptions =
    opportunityType === 'JOB'
      ? [
          { value: '', label: 'Select a job…' },
          ...(jobs.data?.items.map((j) => ({ value: j.id, label: j.title })) ?? []),
        ]
      : [
          { value: '', label: 'Select an internship…' },
          ...(internships.data?.items.map((i) => ({ value: i.id, label: i.title })) ?? []),
        ];

  function handleAnalyze() {
    if (!opportunityId) return;
    skillGap.mutate({ opportunityType, opportunityId });
  }

  const result = skillGap.data;
  const fullResult = fullMatch.data;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Skill Gap Analysis"
        subtitle="Identify and close gaps between your skills and market demand."
      />

      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Select Opportunity
          </h2>
        </Card.Header>
        <Card.Body className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Opportunity Type"
              options={opportunityTypeOptions}
              value={opportunityType}
              onChange={(e) => {
                setOpportunityType(e.target.value as 'JOB' | 'INTERNSHIP');
                setOpportunityId('');
              }}
            />
            <Select
              label="Opportunity"
              options={opportunityOptions}
              value={opportunityId}
              onChange={(e) => setOpportunityId(e.target.value)}
            />
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={!opportunityId}
            loading={skillGap.isPending}
            iconLeft={<FiZap className="w-4 h-4" />}
          >
            Analyze Gap
          </Button>
        </Card.Body>
      </Card>

      {skillGap.isPending && <SkeletonCard />}

      {skillGap.isError && (
        <ErrorState
          title="Analysis failed"
          description="Could not generate skill gap analysis. Please try again."
          onRetry={() => skillGap.reset()}
        />
      )}

      {result && (
        <div className="space-y-4">
          <Card>
            <Card.Header>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Match Result
                </h2>
                <MatchBadge score={result.score} />
              </div>
            </Card.Header>
            <Card.Body className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    Required Skills Met
                  </p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    {result.matchedSkills.length} of {result.requiredSkills.length} ·{' '}
                    {result.matchPercentage}%
                  </p>
                </div>
                <div
                  className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={result.matchPercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Required skills met"
                >
                  <div
                    className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all"
                    style={{ width: `${result.matchPercentage}%` }}
                  />
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {result.narrative}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {result.aiEnhanced
                    ? 'Analysis generated by AI. Skills and percentages are calculated from your profile.'
                    : result.aiUnavailableReason === 'NOT_CONFIGURED'
                      ? 'AI analysis is not enabled — this was calculated from your profile.'
                      : 'AI analysis was unavailable, so this was calculated from your profile.'}
                </p>
              </div>

              {result.studentSkillCount === 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Your profile has no skills recorded yet, so every required skill counts as a gap.{' '}
                  <Link to="/student/skills" className="font-medium underline">
                    Add your skills
                  </Link>{' '}
                  for an accurate match.
                </p>
              )}

              {result.requiredSkills.length === 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  This opportunity does not list any required skills, so there is no gap to close.
                </p>
              )}

              {result.matchedSkills.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2 uppercase tracking-wide">
                    Matched Skills ({result.matchedSkills.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.matchedSkills.map((s) => (
                      <SkillChip
                        key={s.id || s.name}
                        name={s.name}
                        className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      />
                    ))}
                  </div>
                </div>
              )}

              {result.missingSkills.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2 uppercase tracking-wide">
                    Missing Skills ({result.missingSkills.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.missingSkills.map((s) => (
                      <SkillChip
                        key={s.id || s.name}
                        name={s.name}
                        className="bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      />
                    ))}
                  </div>
                </div>
              )}

              {result.preferredSkills.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">
                    Preferred Skills ({result.preferredMatched.length} of{' '}
                    {result.preferredSkills.length} held)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.preferredSkills.map((s) => (
                      <SkillChip key={s.id || s.name} name={s.name} />
                    ))}
                  </div>
                </div>
              )}

              {result.aiAnalysis.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                    <FiTarget className="w-3.5 h-3.5" />
                    Strengths ({result.aiAnalysis.strengths.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.aiAnalysis.strengths.map((s, i) => (
                      <SkillChip
                        key={i}
                        name={s}
                        className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      />
                    ))}
                  </div>
                </div>
              )}

              {result.aiAnalysis.skillGaps.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                    <FiTrendingUp className="w-3.5 h-3.5" />
                    Skill Gaps ({result.aiAnalysis.skillGaps.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.aiAnalysis.skillGaps.map((s, i) => (
                      <SkillChip
                        key={i}
                        name={s}
                        className="bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                      />
                    ))}
                  </div>
                </div>
              )}

              {result.aiAnalysis.recommendedSkills.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                    <FiBookOpen className="w-3.5 h-3.5" />
                    Recommended Skills to Learn ({result.aiAnalysis.recommendedSkills.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.aiAnalysis.recommendedSkills.map((s, i) => (
                      <Link
                        key={i}
                        to={`/student/training?skill=${encodeURIComponent(s)}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-medium border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-950 transition-colors no-underline"
                      >
                        <FiSearch className="w-3 h-3" />
                        {s}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {result.aiAnalysis.matchExplanation && (
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                    Match Explanation
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {result.aiAnalysis.matchExplanation}
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Phase 4: deterministic multi-dimensional match breakdown powered by
              GET /recommendations/full-match/:type/:id. Always present (no AI
              dependency) so the student sees exactly how their match was scored. */}
          {fullResult && <MatchBreakdownPanel full={fullResult} />}
          {fullResult && <ProficiencyGapPanel full={fullResult} />}

          {result.missingSkills.length > 0 && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Recommended Training
                </h2>
              </Card.Header>
              <Card.Body className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Find training programmes to help you close these skill gaps:
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.missingSkills.map((skill) => (
                    <Link
                      key={skill.id || skill.name}
                      to={`/student/training?skill=${encodeURIComponent(skill.id)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-medium border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-950 transition-colors no-underline"
                    >
                      <FiSearch className="w-3 h-3" />
                      Find training for {skill.name}
                    </Link>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}
        </div>
      )}

      {!result && !skillGap.isPending && !skillGap.isError && (
        <EmptyState
          icon={<FiZap />}
          title="Select an opportunity to analyze"
          description="Choose a job or internship above and click Analyze Gap to see your skill match."
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 4: deterministic match breakdown panel
// ---------------------------------------------------------------------------

function MatchBreakdownPanel({ full }: { full: FullMatchAnalysis }) {
  const { breakdown, recommendation, eligibility } = full;
  const entries = (Object.entries(breakdown) as [keyof typeof breakdown, number][]).filter(
    ([key]) => key !== 'eligibility',
  );

  return (
    <Card>
      <Card.Header>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
          <FiBarChart2 className="w-4 h-4" /> Match Breakdown
        </h2>
      </Card.Header>
      <Card.Body className="space-y-4">
        {/* Weighted dimension bars */}
        <div className="space-y-3">
          {entries.map(([key, score]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {BREAKDOWN_LABELS[key] ?? key}
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                  {score}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          ))}

          {/* Eligibility is binary, shown separately */}
          <div className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
            {eligibility.passed ? (
              <FiCheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <FiAlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Eligibility: {eligibility.passed ? 'You qualify' : 'Does not qualify'}
              </p>
              {!eligibility.passed && eligibility.failures.length > 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                  {eligibility.failures[0]}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">
            Recommendation
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {recommendation}
          </p>
        </div>
      </Card.Body>
    </Card>
  );
}

function FiBarChart2({ className }: { className?: string }) {
  // Inline icon to avoid extra import
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Phase 4: proficiency gap table — shows student's level vs required level
// ---------------------------------------------------------------------------

function ProficiencyGapPanel({ full }: { full: FullMatchAnalysis }) {
  const { proficiencyGaps } = full;
  if (proficiencyGaps.length === 0) return null;

  return (
    <Card>
      <Card.Header>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
          <FiTrendingUp className="w-4 h-4" /> Proficiency Gaps
        </h2>
      </Card.Header>
      <Card.Body>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Skills where you need to level up to meet the opportunity&apos;s requirements.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Skill
                </th>
                <th className="text-center pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Your Level
                </th>
                <th className="text-center pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Required
                </th>
                <th className="text-center pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Gap
                </th>
                <th className="text-right pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {proficiencyGaps.map((gap) => (
                <tr
                  key={gap.id}
                  className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="py-2.5">
                    <SkillChip name={gap.name} />
                  </td>
                  <td className="py-2.5 text-center">
                    {gap.studentLevel !== null ? (
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {PROFICIENCY_LABEL[gap.studentLevel]}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                        Not added
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-center">
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      {PROFICIENCY_LABEL[gap.requiredLevel]}
                    </span>
                  </td>
                  <td className="py-2.5 text-center">
                    {gap.missing ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 uppercase tracking-wide">
                        Missing
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                        +{gap.gapLevels} level{gap.gapLevels > 1 ? 's' : ''}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <Link
                      to={`/student/training?skill=${encodeURIComponent(gap.name)}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Find training <FiSearch className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card.Body>
    </Card>
  );
}
