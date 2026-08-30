/**
 * Phase 10 — Industry Skill Outcome Intelligence component.
 *
 * Renders a horizontal bar chart of the top in-demand skills at the
 * institution, paired with selection rate (an *association* metric, not
 * causation). Every metric is rendered as a single row so the UI degrades
 * gracefully when the dataset is small.
 *
 * Reuses Card, EmptyState, ErrorState, Skeleton primitives and the same
 * Recharts setup as the existing InstitutionDashboard charts.
 */

import {
  FiBarChart2,
  FiTarget,
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
  Legend,
} from 'recharts';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useThemeStore } from '@/store/theme';
import type { SkillOutcomeAnalytics, SkillOutcomeMetric } from '@aip/types';

interface SkillOutcomeChartProps {
  data?: SkillOutcomeAnalytics;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function strengthColor(strength: number): string {
  if (strength >= 70) return '#10b981'; // emerald
  if (strength >= 40) return '#f59e0b'; // amber
  return '#64748b'; // slate
}

function strengthLabel(strength: number): string {
  if (strength >= 70) return 'Strong';
  if (strength >= 40) return 'Moderate';
  return 'Weak';
}

function strengthVariant(strength: number): 'success' | 'warning' | 'default' {
  if (strength >= 70) return 'success';
  if (strength >= 40) return 'warning';
  return 'default';
}

export function SkillOutcomeChart({
  data,
  isLoading,
  isError,
  onRetry,
}: SkillOutcomeChartProps) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const axisColor = isDark ? '#64748b' : '#94a3b8';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  if (isError) return onRetry ? <ErrorState onRetry={onRetry} /> : <ErrorState />;
  if (isLoading) return <SkeletonCard />;
  if (!data) return null;

  const metrics: SkillOutcomeMetric[] = data.metrics ?? [];

  if (data.insufficientData || metrics.length === 0) {
    return (
      <Card>
        <Card.Header>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <FiBarChart2 /> Skill Outcome Intelligence
          </h3>
        </Card.Header>
        <Card.Body>
          <EmptyState
            icon={<FiTarget />}
            title="Insufficient data"
            description={`The minimum sample size is ${data.minimumSampleSize} applicants per skill. Not enough data to compute association metrics yet — once students start applying and getting selected, the rankings will appear here.`}
          />
        </Card.Body>
      </Card>
    );
  }

  const top = metrics.slice(0, 15);
  const chartData = top.map((m) => ({
    name: m.name.length > 16 ? `${m.name.slice(0, 16)}…` : m.name,
    strength: m.skillOutcomeStrength,
    selectionRate: m.selectionRate,
    demand: m.skillDemandCount,
  }));

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <FiBarChart2 /> Skill Outcome Intelligence
          </h3>
          <Badge size="sm">Top {top.length} skills</Badge>
        </div>
      </Card.Header>
      <Card.Body className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Each skill is ranked by its{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            association with selection outcomes
          </span>{' '}
          at this institution. Higher values mean the skill is observed more
          often among selected applicants — this is an association metric, not
          causation.
        </p>

        <div className="h-[340px] -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: axisColor }}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}`}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={120}
                tick={{ fontSize: 11, fill: axisColor }}
                interval={0}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]!.payload as (typeof chartData)[number];
                  return (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs shadow">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">
                        {d.name}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">
                        Outcome strength: {d.strength}/100
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">
                        Selection rate: {d.selectionRate.toFixed(1)}%
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">
                        Demand: {d.demand} opportunities
                      </p>
                    </div>
                  );
                }}
              />
              <Legend />
              <Bar
                dataKey="strength"
                name="Outcome strength"
                radius={[0, 4, 4, 0]}
              >
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={strengthColor(entry.strength)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top-3 highlight list */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {top.slice(0, 3).map((m) => (
            <div
              key={m.skillId}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {m.name}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {m.skillDemandCount} opps · {m.selectedWithSkill}/{m.applicantsWithSkill} selected
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Badge size="sm" variant={strengthVariant(m.skillOutcomeStrength)}>
                  {strengthLabel(m.skillOutcomeStrength)}
                </Badge>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
                  {m.skillOutcomeStrength}/100
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}

export default SkillOutcomeChart;
