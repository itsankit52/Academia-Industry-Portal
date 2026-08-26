import { MATCH_THRESHOLDS } from '@aip/config';
import { cn } from '@/lib/cn';

interface MatchBadgeProps {
  score: number;
  className?: string;
}

// The cut-offs come from `MATCH_THRESHOLDS` so the badge always agrees with the
// `level` the API computed for the same score. They were hardcoded as 80/60/40
// here while the backend used 85 for a strong match, so scores of 80-84 were
// labelled "Strong Match" in the badge and "GOOD_MATCH" everywhere else.
function getLevel(score: number): { label: string; classes: string } {
  if (score >= MATCH_THRESHOLDS.STRONG) return { label: 'Strong Match', classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800' };
  if (score >= MATCH_THRESHOLDS.GOOD) return { label: 'Good Match', classes: 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800' };
  if (score >= MATCH_THRESHOLDS.PARTIAL) return { label: 'Partial Match', classes: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800' };
  return { label: 'Low Match', classes: 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' };
}

export default function MatchBadge({ score, className }: MatchBadgeProps) {
  const { label, classes } = getLevel(score);
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', classes, className)}>
      <span className="tabular-nums">{score}%</span>
      <span>{label}</span>
    </span>
  );
}

export { MatchBadge };
