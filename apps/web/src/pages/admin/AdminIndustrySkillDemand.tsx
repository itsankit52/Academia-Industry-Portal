import PageHeader from '@/components/ui/PageHeader';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import { FiTrendingUp } from 'react-icons/fi';
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
import { useAdminIndustrySkillDemand } from '@/hooks/queries/useAdminAnalytics';

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#818cf8', '#4f46e5',
  '#6366f1', '#8b5cf6', '#a78bfa', '#818cf8', '#4f46e5',
  '#6366f1', '#8b5cf6', '#a78bfa', '#818cf8', '#4f46e5',
];

export default function AdminIndustrySkillDemand() {
  const { data: demand = [], isLoading, isError, refetch } = useAdminIndustrySkillDemand();

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Industry Skill Demand"
        subtitle="Skills most demanded by hiring companies across the platform."
      />

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Demand by Skill (% of job listings requiring this skill)
        </h3>

        {isLoading ? (
          <div className="h-[420px] animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg" />
        ) : demand.length === 0 ? (
          <EmptyState icon={<FiTrendingUp />} title="No demand data available" />
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={demand} margin={{ bottom: 64, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="skill"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                angle={-45}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                unit="%"
                domain={[0, 100]}
              />
              <Tooltip formatter={(value) => [`${value}%`, 'Demand']} />
              <Bar dataKey="demandPercent" name="Demand %">
                {demand.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {!isLoading && demand.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {demand.map((item, index) => (
            <div
              key={item.skill}
              className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.skill}</p>
                {item.category && (
                  <p className="text-xs text-slate-400 mt-0.5">{item.category.replace(/_/g, ' ')}</p>
                )}
              </div>
              <span
                className="text-sm font-semibold ml-2 shrink-0"
                style={{ color: COLORS[index % COLORS.length] }}
              >
                {item.demandPercent}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
