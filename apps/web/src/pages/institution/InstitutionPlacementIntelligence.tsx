/**
 * Phase 10 — Institution Placement Intelligence page.
 *
 * Renders the institution's complete placement readiness landscape:
 *   - Readiness distribution (bar chart)
 *   - Outcome funnel
 *   - Intervention panel (CRITICAL/HIGH/MEDIUM/LOW)
 *   - Skill outcome intelligence
 *
 * Uses the same chart/card patterns as InstitutionDashboard. All data is
 * server-side deterministic with institution scoping — company users are
 * blocked at the route level (INSTITUTION | ADMIN only).
 */

import {
  FiTarget,
  FiTrendingUp,
  FiAlertTriangle,
  FiBarChart2,
} from 'react-icons/fi';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useThemeStore } from '@/store/theme';
import { useInstitutionPlacementReadiness } from '@/hooks/queries/useInstitutionPlacementReadiness';
import { useInstitutionInterventions } from '@/hooks/queries/useInstitutionInterventions';
import { useSkillOutcomeAnalytics } from '@/hooks/queries/useSkillOutcomeAnalytics';
import { InstitutionInterventionsPanel } from '@/components/placement/InstitutionInterventionsPanel';
import { SkillOutcomeChart } from '@/components/placement/SkillOutcomeChart';
import { OutcomeFunnel } from '@/components/placement/OutcomeFunnel';
import type { PlacementReadinessLevel } from '@aip/types';

const LEVEL_ORDER: PlacementReadinessLevel[] = [
  'PLACEMENT_READY',
  'NEARLY_READY',
  'DEVELOPING',
  'NEEDS_IMPROVEMENT',
  'NOT_READY',
];

const LEVEL_LABEL: Record<PlacementReadinessLevel, string> = {
  PLACEMENT_READY: 'Ready',
  NEARLY_READY: 'Nearly Ready',
  DEVELOPING: 'Developing',
  NEEDS_IMPROVEMENT: 'Needs Work',
  NOT_READY: 'Not Ready',
};

const LEVEL_COLOR: Record<PlacementReadinessLevel, string> = {
  PLACEMENT_READY: '#10b981', // emerald
  NEARLY_READY: '#06b6d4',   // cyan
  DEVELOPING: '#6366f1',      // indigo
  NEEDS_IMPROVEMENT: '#f59e0b', // amber
  NOT_READY: '#ef4444',      // red
};

const LEVEL_BADGE: Record<PlacementReadinessLevel, 'success' | 'info' | 'default' | 'warning' | 'danger'> = {
  PLACEMENT_READY: 'success',
  NEARLY_READY: 'info',
  DEVELOPING: 'default',
  NEEDS_IMPROVEMENT: 'warning',
  NOT_READY: 'danger',
};

function ChartSkeleton() {
  return <div className="h-[300px] animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg" />;
}

function readinessDistributionChart(
  data: Array<{ level: PlacementReadinessLevel; count: number; percentage: number }> | undefined,
  isDark: boolean,
  axisColor: string,
  gridColor: string,
) {
  if (!data || data.every((d) => d.count === 0)) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <EmptyState
          title="No readiness data yet"
          description="Student readiness scores will appear here once the engine processes student profiles."
        />
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="level"
          tick={{ fontSize: 11, fill: axisColor }}
          tickFormatter={(v: string) => LEVEL_LABEL[v as PlacementReadinessLevel] ?? v}
          interval={0}
          angle={-20}
          textAnchor="end"
        />
        <YAxis tick={{ fontSize: 11, fill: axisColor }} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]!.payload as (typeof data)[number];
            return (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs shadow">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {LEVEL_LABEL[d.level]}
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  {d.count} student{d.count !== 1 ? 's' : ''} ({d.percentage.toFixed(1)}%)
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.level}
              fill={LEVEL_COLOR[entry.level]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function InstitutionPlacementIntelligence() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const axisColor = isDark ? '#64748b' : '#94a3b8';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  const {
    data: readiness,
    isLoading: readinessLoading,
    isError: readinessError,
    refetch: refetchReadiness,
  } = useInstitutionPlacementReadiness();
  const {
    data: interventions,
    isLoading: interventionsLoading,
    isError: interventionsError,
    refetch: refetchInterventions,
  } = useInstitutionInterventions();
  const {
    data: skillOutcomes,
    isLoading: skillOutcomesLoading,
    isError: skillOutcomesError,
    refetch: refetchSkillOutcomes,
  } = useSkillOutcomeAnalytics();

  const hasError = readinessError || interventionsError || skillOutcomesError;
  const handleRetry = () => {
    void refetchReadiness();
    void refetchInterventions();
    void refetchSkillOutcomes();
  };

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Placement Readiness & Intelligence"
        subtitle="Comprehensive placement readiness distribution, outcome funnel, student interventions, and skill outcome analytics for your institution."
      />

      {hasError && <ErrorState onRetry={handleRetry} />}

      {/* Top stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {readinessLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Students"
              value={readiness?.totalStudents ?? 0}
              icon={<FiTarget />}
            />
            <StatCard
              label="Avg Readiness"
              value={
                readiness?.averageScore !== undefined
                  ? `${readiness.averageScore}/100`
                  : '—'
              }
              icon={<FiTrendingUp />}
            />
            <StatCard
              label="Ready / Nearly Ready"
              value={(readiness?.placementReadyCount ?? 0) + (readiness?.nearlyReadyCount ?? 0)}
              icon={<FiTarget />}
            />
            <StatCard
              label="Needs Intervention"
              value={readiness?.needsInterventionCount ?? 0}
              icon={<FiAlertTriangle />}
            />
            <StatCard
              label="Total Applications"
              value={readiness?.outcomes?.totalApplications ?? 0}
              icon={<FiBarChart2 />}
            />
          </>
        )}
      </div>

      {/* Readout by level — small stat tiles */}
      {!readinessLoading && readiness && readiness.totalStudents > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {LEVEL_ORDER.map((level) => {
            const dist = readiness.readinessDistribution?.find((d) => d.level === level);
            const count = dist?.count ?? 0;
            const pct = dist?.percentage ?? 0;
            return (
              <div
                key={level}
                className="rounded-xl border p-4 text-center"
                style={{ borderColor: `${LEVEL_COLOR[level]}33` }}
              >
                <div
                  className="text-2xl font-bold mb-1"
                  style={{ color: LEVEL_COLOR[level] }}
                >
                  {count}
                </div>
                <Badge size="sm" variant={LEVEL_BADGE[level]}>
                  {LEVEL_LABEL[level]}
                </Badge>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {pct.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Readiness distribution */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Readiness Distribution
          </h3>
          {readinessLoading ? (
            <ChartSkeleton />
          ) : (
            readinessDistributionChart(
              readiness?.readinessDistribution,
              isDark,
              axisColor,
              gridColor,
            )
          )}
        </div>

        {/* Outcome funnel */}
        <OutcomeFunnel
          data={readiness?.outcomes}
          isLoading={readinessLoading}
          isError={readinessError}
          onRetry={() => void refetchReadiness()}
          title="Institution Outcome Funnel"
          variant="institution"
        />
      </div>

      {/* Interventions panel */}
      <InstitutionInterventionsPanel
        data={interventions}
        isLoading={interventionsLoading}
        isError={interventionsError}
        onRetry={() => void refetchInterventions()}
      />

      {/* Skill outcome intelligence */}
      <SkillOutcomeChart
        data={skillOutcomes}
        isLoading={skillOutcomesLoading}
        isError={skillOutcomesError}
        onRetry={() => void refetchSkillOutcomes()}
      />
    </div>
  );
}
