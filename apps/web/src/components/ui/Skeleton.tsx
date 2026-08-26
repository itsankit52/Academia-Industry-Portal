import { cn } from '@/lib/cn';

interface SkeletonProps {
  className?: string;
}

export function SkeletonText({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse bg-slate-200 rounded h-4 dark:bg-slate-800', className)} />;
}

export function SkeletonAvatar({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse bg-slate-200 rounded-full w-10 h-10 shrink-0 dark:bg-slate-800', className)} />;
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse bg-white rounded-xl border border-slate-200 p-6 space-y-3 dark:bg-slate-900 dark:border-slate-800', className)}>
      <div className="h-4 bg-slate-200 rounded w-3/4 dark:bg-slate-800" />
      <div className="h-3 bg-slate-200 rounded w-1/2 dark:bg-slate-800" />
      <div className="h-3 bg-slate-200 rounded w-2/3 dark:bg-slate-800" />
    </div>
  );
}

interface SkeletonTableRowsProps {
  rows?: number;
  cols?: number;
}

export function SkeletonTableRows({ rows = 5, cols = 4 }: SkeletonTableRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="animate-pulse h-4 bg-slate-200 rounded dark:bg-slate-800" style={{ width: `${60 + (j % 3) * 15}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse bg-slate-200 rounded dark:bg-slate-800', className)} />;
}
