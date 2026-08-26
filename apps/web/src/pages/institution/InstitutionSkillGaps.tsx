import { useState, useMemo } from 'react';
import { FiTrendingDown } from 'react-icons/fi';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { useThemeStore } from '@/store/theme';
import { useInstitutionSkillGaps } from '@/hooks/queries/useInstitutionAnalytics';

function ChartSkeleton() {
  return <div className="h-[300px] animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg" />;
}

export default function InstitutionSkillGaps() {
  const [categoryFilter, setCategoryFilter] = useState('');
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const axisColor = isDark ? '#64748b' : '#94a3b8';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  const { data: skillGaps, isLoading, isError, refetch } = useInstitutionSkillGaps();

  const categories = useMemo(() => {
    if (!skillGaps) return [];
    const cats = [...new Set(skillGaps.map((s) => s.category).filter(Boolean))] as string[];
    return cats.sort();
  }, [skillGaps]);

  const filtered = useMemo(() => {
    if (!skillGaps) return [];
    if (!categoryFilter) return skillGaps;
    return skillGaps.filter((s) => s.category === categoryFilter);
  }, [skillGaps, categoryFilter]);

  if (isError) return <ErrorState onRetry={refetch} />;

  const chartData = (skillGaps ?? []).slice(0, 15).map((s) => ({
    name: s.name,
    count: s.missingCount,
  }));

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Skill Gaps"
        subtitle="Top skills your students are missing across published job and internship requirements."
      />

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Top 15 Missing Skills
        </h3>
        {isLoading ? (
          <ChartSkeleton />
        ) : chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center">
            <EmptyState
              icon={<FiTrendingDown />}
              title="No skill gap data"
              description="This appears when published jobs/internships have required skills your students don't have."
            />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart layout="vertical" data={chartData} margin={{ left: 16, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" name="Students Missing" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Filter by Category
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 py-2.5 px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>#</Table.Th>
            <Table.Th>Skill</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Students Missing</Table.Th>
            <Table.Th>% of Students</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? null : filtered.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <EmptyState icon={<FiTrendingDown />} title="No skills match the selected filter." />
              </td>
            </tr>
          ) : (
            filtered.map((s, i) => (
              <tr key={s.skillId}>
                <Table.Td className="text-slate-400 dark:text-slate-500">{i + 1}</Table.Td>
                <Table.Td className="font-medium text-slate-900 dark:text-slate-100">{s.name}</Table.Td>
                <Table.Td>{s.category ?? '—'}</Table.Td>
                <Table.Td>{s.missingCount}</Table.Td>
                <Table.Td>{s.percentage.toFixed(1)}%</Table.Td>
              </tr>
            ))
          )}
        </Table.Body>
      </Table>
    </div>
  );
}
