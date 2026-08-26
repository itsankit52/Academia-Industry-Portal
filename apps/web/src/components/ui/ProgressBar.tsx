import { cn } from '@/lib/cn';

interface ProgressBarProps {
  value: number;
  label?: string;
  className?: string;
}

function getColor(value: number) {
  if (value >= 75) return 'bg-emerald-500';
  if (value >= 50) return 'bg-sky-500';
  if (value >= 25) return 'bg-amber-500';
  return 'bg-rose-500';
}

export default function ProgressBar({ value, label, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="flex justify-between text-xs text-slate-600 mb-1 dark:text-slate-400">
          <span>{label}</span>
          <span className="font-medium">{clamped}%</span>
        </div>
      )}
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-800" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={cn('h-full rounded-full transition-all duration-300', getColor(clamped))}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export { ProgressBar };
