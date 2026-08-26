import { type ReactNode } from 'react';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { cn } from '@/lib/cn';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: number;
  className?: string;
}

export default function StatCard({ label, value, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800', className)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 text-lg shrink-0 dark:bg-indigo-950 dark:text-indigo-400">
            {icon}
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-slate-900 tracking-tight dark:text-slate-100">{value}</p>
      {trend !== undefined && (
        <div className={cn('flex items-center gap-1 mt-2 text-sm font-medium', trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
          {trend >= 0 ? <FiTrendingUp className="w-4 h-4" /> : <FiTrendingDown className="w-4 h-4" />}
          <span>{Math.abs(trend)}% from last month</span>
        </div>
      )}
    </div>
  );
}

export { StatCard };
