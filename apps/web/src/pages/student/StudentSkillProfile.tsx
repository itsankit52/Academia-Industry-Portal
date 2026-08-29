import { Link } from 'react-router-dom';
import {
  FiAward,
  FiBookOpen,
  FiCheckCircle,
  FiFileText,
  FiLayers,
  FiTarget,
  FiTrendingUp,
  FiZap,
  FiActivity,
  FiBarChart2,
  FiClock,
  FiAlertTriangle,
  FiCheckSquare,
  FiStar,
} from 'react-icons/fi';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { type Proficiency, type SkillCategory } from '@aip/config';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import SkillChip from '@/components/ui/SkillChip';
import {
  useSkillProfile,
  useSkillTimeline,
  type SkillProfile,
  type CategoryGroup,
  type SkillTimelineEvent,
} from '@/hooks/queries/useSkillProfile';

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  PROGRAMMING: 'Programming',
  FRONTEND: 'Frontend',
  BACKEND: 'Backend',
  DATABASE: 'Database',
  CLOUD: 'Cloud',
  DEVOPS: 'DevOps',
  DATA_SCIENCE: 'Data Science',
  AI_ML: 'AI / ML',
  MOBILE: 'Mobile',
  CYBERSECURITY: 'Cybersecurity',
  SOFT_SKILLS: 'Soft Skills',
  OTHER: 'Other',
};

const CATEGORY_ORDER: SkillCategory[] = [
  'PROGRAMMING',
  'FRONTEND',
  'BACKEND',
  'DATABASE',
  'CLOUD',
  'DEVOPS',
  'DATA_SCIENCE',
  'AI_ML',
  'MOBILE',
  'CYBERSECURITY',
  'SOFT_SKILLS',
  'OTHER',
];

const PROFICIENCY_VALUE: Record<Proficiency, number> = {
  BEGINNER: 25,
  INTERMEDIATE: 50,
  ADVANCED: 75,
  EXPERT: 100,
};

const PROFICIENCY_RANK: Record<Proficiency, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

const CATEGORY_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#10b981',
  '#06b6d4',
  '#0ea5e9',
  '#a855f7',
  '#64748b',
];

function proficiencyFromAvg(avg: number): Proficiency {
  if (avg >= 87.5) return 'EXPERT';
  if (avg >= 62.5) return 'ADVANCED';
  if (avg >= 37.5) return 'INTERMEDIATE';
  return 'BEGINNER';
}

function readinessTone(value: number) {
  if (value >= 75) return { ring: 'text-emerald-500', bar: 'bg-emerald-500' };
  if (value >= 50) return { ring: 'text-sky-500', bar: 'bg-sky-500' };
  if (value >= 25) return { ring: 'text-amber-500', bar: 'bg-amber-500' };
  return { ring: 'text-rose-500', bar: 'bg-rose-500' };
}

function proficiencyTone(p: Proficiency) {
  if (p === 'EXPERT') return { ring: 'text-emerald-500', bar: 'bg-emerald-500' };
  if (p === 'ADVANCED') return { ring: 'text-sky-500', bar: 'bg-sky-500' };
  if (p === 'INTERMEDIATE') return { ring: 'text-amber-500', bar: 'bg-amber-500' };
  return { ring: 'text-rose-500', bar: 'bg-rose-500' };
}

function sortCategories(categories: CategoryGroup[]): CategoryGroup[] {
  return [...categories].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

export default function StudentSkillProfile() {
  const { data, isLoading, isError, refetch } = useSkillProfile();
  const { data: timeline, isLoading: timelineLoading } = useSkillTimeline();

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="My Skill Profile"
        subtitle="A unified view of your technical and soft skills, evidence, and industry alignment."
      />

      {isError && <ErrorState onRetry={() => void refetch()} />}

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {data && <SkillProfileBody profile={data} />}
      {data && <SkillTimelineSection events={timeline?.events ?? []} loading={timelineLoading} />}
    </div>
  );
}

function SkillProfileBody({ profile }: { profile: SkillProfile }) {
  const tone = readinessTone(profile.totals.readinessScore);
  const sortedCategories = sortCategories(profile.categories);
  const total =
    profile.sourceBreakdown.fromAssessments +
    profile.sourceBreakdown.fromResume +
    profile.sourceBreakdown.fromManual;
  const fromAssessmentsPct =
    total > 0 ? (profile.sourceBreakdown.fromAssessments / total) * 100 : 0;
  const fromResumePct = total > 0 ? (profile.sourceBreakdown.fromResume / total) * 100 : 0;
  const fromManualPct = total > 0 ? (profile.sourceBreakdown.fromManual / total) * 100 : 0;

  if (profile.totals.totalSkills === 0) {
    return (
      <EmptyState
        icon={<FiActivity />}
        title="Your skill profile is empty"
        description="Add skills manually, upload a resume, or take a skill assessment to populate your profile."
        action={
          <div className="flex gap-2 justify-center">
            <Link to="/student/skills">
              <Button>Add Skills</Button>
            </Link>
            <Link to="/student/assessments">
              <Button variant="outline">Take Assessment</Button>
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <>
      {/* Top stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Skill Readiness</p>
          <div className="flex items-end gap-2 mt-2">
            <p className={`text-3xl font-bold tracking-tight ${tone.ring}`}>
              {profile.totals.readinessScore}%
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">industry-weighted</p>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full ${tone.bar}`}
              style={{ width: `${profile.totals.readinessScore}%` }}
            />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Skills</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {profile.totals.totalSkills}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {profile.totals.technicalCount} technical · {profile.totals.softSkillsCount} soft
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Avg Proficiency</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {profile.totals.averageProficiency}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {proficiencyFromAvg(profile.totals.averageProficiency).toLowerCase()} overall
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Assessed Skills</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {profile.totals.assessedSkillsCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            via technical assessments
          </p>
        </div>
      </div>

      {/* Visual charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SkillCategoryChart categories={sortedCategories} />
        </div>
        <div>
          <ProficiencyDistributionChart
            technical={profile.totals.technicalCount}
            soft={profile.totals.softSkillsCount}
          />
        </div>
      </div>

      {/* Source breakdown bar */}
      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Evidence Sources
          </h2>
        </Card.Header>
        <Card.Body>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            How your skills were discovered and verified.
          </p>
          <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
            <div
              className="bg-indigo-500"
              style={{ width: `${fromAssessmentsPct}%` }}
              title={`Assessments: ${profile.sourceBreakdown.fromAssessments}`}
            />
            <div
              className="bg-violet-500"
              style={{ width: `${fromResumePct}%` }}
              title={`Resume: ${profile.sourceBreakdown.fromResume}`}
            />
            <div
              className="bg-slate-400"
              style={{ width: `${fromManualPct}%` }}
              title={`Manual: ${profile.sourceBreakdown.fromManual}`}
            />
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              Assessment · {profile.sourceBreakdown.fromAssessments}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              Resume · {profile.sourceBreakdown.fromResume}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              Manual · {profile.sourceBreakdown.fromManual}
            </span>
          </div>
        </Card.Body>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strengths */}
        <StrengthsCard strengths={profile.strengths} />

        {/* Gaps — cross-references the top industry-missing skills so a
            "weak" skill that's also a high-demand skill stands out. */}
        <GapsCard
          gaps={profile.gaps}
          highDemandIds={new Set(profile.industry.topMissing.map((m) => m.id))}
        />
      </div>

      {/* Industry alignment section */}
      <IndustryAlignmentCard
        topMatched={profile.industry.topMatched}
        topMissing={profile.industry.topMissing}
      />

      {/* Per-category breakdown */}
      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <FiLayers /> Skills by Category
          </h2>
        </Card.Header>
        <Card.Body className="space-y-6">
          {sortedCategories.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No skills categorized yet.</p>
          ) : (
            sortedCategories.map((cat) => <CategorySection key={cat.category} cat={cat} />)
          )}
        </Card.Body>
      </Card>

      {/* Next steps */}
      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <FiTarget /> Recommended Next Step
          </h2>
        </Card.Header>
        <Card.Body>
          <NextStepSuggestion profile={profile} />
        </Card.Body>
      </Card>
    </>
  );
}

function StrengthsCard({ strengths }: { strengths: SkillProfile['strengths'] }) {
  return (
    <Card>
      <Card.Header>
        <h2 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
          <FiCheckCircle /> Your Strengths
        </h2>
      </Card.Header>
      <Card.Body>
        {strengths.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No strengths yet. Take assessments to elevate your proficiency.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {strengths.map((s) => (
              <li key={s.skill.id} className="flex items-center justify-between gap-2">
                <SkillChip
                  name={s.skill.name}
                  proficiency={s.proficiency}
                  className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {CATEGORY_LABELS[s.category]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}

function GapsCard({
  gaps,
  highDemandIds,
}: {
  gaps: SkillProfile['gaps'];
  highDemandIds: Set<string>;
}) {
  return (
    <Card>
      <Card.Header>
        <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
          <FiTrendingUp /> Skills to Improve
        </h2>
      </Card.Header>
      <Card.Body>
        {gaps.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No weak skills detected. Great job.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {gaps.map((s) => {
              const isHighDemand = highDemandIds.has(s.skill.id);
              return (
                <li key={s.skill.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <SkillChip
                      name={s.skill.name}
                      proficiency={s.proficiency}
                      className="bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                    />
                    {isHighDemand && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 uppercase tracking-wide"
                        title="High industry demand — closing this gap is especially valuable"
                      >
                        High demand
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {CATEGORY_LABELS[s.category]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}

function IndustryAlignmentCard({
  topMatched,
  topMissing,
}: {
  topMatched: SkillProfile['industry']['topMatched'];
  topMissing: SkillProfile['industry']['topMissing'];
}) {
  const matched = topMatched.length;
  const missing = topMissing.length;
  const total = matched + missing;
  const alignmentPct = total > 0 ? Math.round((matched / total) * 100) : 0;
  const tone = readinessTone(alignmentPct);

  return (
    <Card>
      <Card.Header>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
          <FiBarChart2 /> Industry Alignment
        </h2>
      </Card.Header>
      <Card.Body className="space-y-5">
        <div>
          <div className="flex items-end justify-between mb-1.5">
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Matched Industry Skills
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Based on top {total} skills most demanded by hiring companies.
              </p>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${tone.ring}`}>{alignmentPct}%</p>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${tone.bar} transition-all`}
              style={{ width: `${alignmentPct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2 uppercase tracking-wide flex items-center gap-1.5">
              <FiCheckSquare className="w-3.5 h-3.5" /> Matched ({matched})
            </p>
            {topMatched.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                None of the top-demanded skills are in your profile yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {topMatched.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800"
                  >
                    <SkillChip
                      name={s.name}
                      className="bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700"
                    />
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 tabular-nums">
                      {s.demandCount} {s.demandCount === 1 ? 'opportunity' : 'opportunities'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-2 uppercase tracking-wide flex items-center gap-1.5">
              <FiAlertTriangle className="w-3.5 h-3.5" /> Missing ({missing})
            </p>
            {topMissing.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You're aligned with industry demand — great work.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {topMissing.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800"
                  >
                    <Link
                      to={`/student/training?skill=${encodeURIComponent(s.name)}`}
                      className="text-xs font-medium text-rose-700 dark:text-rose-300 hover:underline"
                    >
                      {s.name}
                    </Link>
                    <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300 tabular-nums">
                      {s.missingCount} {s.missingCount === 1 ? 'opportunity' : 'opportunities'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

function SkillCategoryChart({ categories }: { categories: CategoryGroup[] }) {
  if (categories.length === 0) return null;
  // Build a radar-friendly data set: one entry per category, with the average
  // proficiency (0-100) and the count as the second axis. Using a single
  // filled radar (averageProficiency) gives the cleanest visual cue of
  // category balance.
  const data = categories.map((c) => ({
    category: CATEGORY_LABELS[c.category] ?? c.category,
    fullCategory: c.category,
    proficiency: Math.round((c.averageProficiency / 4) * 100),
    count: c.count,
  }));

  return (
    <Card>
      <Card.Header>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
          <FiBarChart2 /> Skill Category Distribution
        </h2>
      </Card.Header>
      <Card.Body>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="80%">
              <PolarGrid stroke="#cbd5e1" strokeOpacity={0.5} />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: '#64748b' }} />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
              />
              <Radar
                name="Avg Proficiency"
                dataKey="proficiency"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.35}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === 'proficiency' ? `${value}%` : value,
                  name === 'proficiency' ? 'Avg Proficiency' : 'Skill Count',
                ]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center mt-2">
          Average proficiency per skill category, scaled 0-100.
        </p>
      </Card.Body>
    </Card>
  );
}

function ProficiencyDistributionChart({ technical, soft }: { technical: number; soft: number }) {
  const data = [
    { name: 'Technical', value: technical, color: '#6366f1' },
    { name: 'Soft Skills', value: soft, color: '#a855f7' },
  ].filter((d) => d.value > 0);

  if (data.length === 0) return null;

  return (
    <Card>
      <Card.Header>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
          <FiStar /> Skill Types
        </h2>
      </Card.Header>
      <Card.Body>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Technical vs. soft skill split.
        </div>
      </Card.Body>
    </Card>
  );
}

function CategorySection({ cat }: { cat: CategoryGroup }) {
  const avgPercent = Math.round((cat.averageProficiency / 4) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {CATEGORY_LABELS[cat.category]}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {cat.count} {cat.count === 1 ? 'skill' : 'skills'}
          </span>
        </div>
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Avg {avgPercent}%
        </span>
      </div>
      <ProgressBar value={avgPercent} className="mb-3" />
      <div className="space-y-2">
        {cat.skills.map((s) => (
          <div
            key={s.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <SkillChip name={s.skill.name} proficiency={s.proficiency} />
                {s.evidence.resumeMentioned && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-violet-600 dark:text-violet-400"
                    title="Mentioned in your resume"
                  >
                    <FiFileText className="w-3 h-3" /> Resume
                  </span>
                )}
                {s.evidence.assessmentCount > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-indigo-600 dark:text-indigo-400"
                    title={`Verified across ${s.evidence.assessmentCount} assessment(s)`}
                  >
                    <FiZap className="w-3 h-3" /> Assessed
                  </span>
                )}
                {s.yearsExperience !== undefined && s.yearsExperience > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    {s.yearsExperience}y exp
                  </span>
                )}
              </div>
              {s.evidence.trainingMatches.length > 0 && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Suggested training: {s.evidence.trainingMatches[0]!.title}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {s.evidence.assessmentAverageScore !== null && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Score</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {s.evidence.assessmentAverageScore.toFixed(0)}%
                  </p>
                </div>
              )}
              <ProgressBar value={PROFICIENCY_VALUE[s.proficiency]} className="w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NextStepSuggestion({ profile }: { profile: SkillProfile }) {
  if (profile.totals.assessedSkillsCount === 0) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Take an assessment to verify your skills
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Assessments convert self-reported proficiency into verified scores that update your
            profile.
          </p>
        </div>
        <Link to="/student/assessments">
          <Button iconLeft={<FiZap />}>Generate Assessment</Button>
        </Link>
      </div>
    );
  }
  const topGap = profile.gaps[0] ?? profile.industry.topMissing[0];
  if (!topGap) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Your profile is well-aligned with industry demand. Keep an eye on recommended opportunities.
      </p>
    );
  }
  const skillName = 'name' in topGap ? topGap.name : topGap.skill.name;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Close the gap on <span className="text-indigo-600 dark:text-indigo-400">{skillName}</span>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Find industry-aligned training or take a fresh assessment on this skill.
        </p>
      </div>
      <div className="flex gap-2">
        <Link to={`/student/training?skill=${encodeURIComponent(skillName)}`}>
          <Button variant="outline" iconLeft={<FiAward />}>
            Find training
          </Button>
        </Link>
        <Link to="/student/assessments">
          <Button iconLeft={<FiZap />}>Take assessment</Button>
        </Link>
      </div>
    </div>
  );
}

function SkillTimelineSection({
  events,
  loading,
}: {
  events: SkillTimelineEvent[];
  loading: boolean;
}) {
  if (loading) return <SkeletonCard />;
  if (events.length === 0) return null;

  return (
    <Card>
      <Card.Header>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
          <FiClock /> Skill Development Timeline
        </h2>
      </Card.Header>
      <Card.Body>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Recent skill additions and assessment activity, newest first.
        </p>
        <ol className="space-y-3">
          {events.slice(0, 12).map((e) => (
            <TimelineRow key={`${e.type}-${e.id}-${e.at}`} event={e} />
          ))}
        </ol>
      </Card.Body>
    </Card>
  );
}

function TimelineRow({ event }: { event: SkillTimelineEvent }) {
  if (event.type === 'STUDENT_SKILL_CREATED') {
    const tone = event.toProficiency
      ? proficiencyTone(event.toProficiency)
      : { bar: 'bg-slate-400' };
    return (
      <li className="flex items-start gap-3">
        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${tone.bar}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Added <span className="font-medium">{event.skillName ?? 'skill'}</span> at{' '}
            <span className="text-xs font-semibold uppercase tracking-wide">
              {(event.toProficiency ?? '').toLowerCase()}
            </span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {formatDistanceToNow(new Date(event.at), { addSuffix: true })}
          </p>
        </div>
      </li>
    );
  }
  if (event.type === 'ASSESSMENT') {
    const pct = event.scorePercent ?? 0;
    const tone = readinessTone(pct);
    return (
      <li className="flex items-start gap-3">
        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${tone.bar}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Assessment on <span className="font-medium">{event.skillName ?? 'skill'}</span> ·{' '}
            <span className={`font-semibold tabular-nums ${tone.ring}`}>{pct}%</span>
            {event.feedback && (
              <span className="text-slate-500 dark:text-slate-400"> — {event.feedback}</span>
            )}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {formatDistanceToNow(new Date(event.at), { addSuffix: true })}
          </p>
        </div>
      </li>
    );
  }
  return null;
}

// Re-export the proficiency rank so other components (e.g. dashboard) can
// surface a numeric strength signal without duplicating the mapping.
export { PROFICIENCY_RANK, PROFICIENCY_VALUE };
