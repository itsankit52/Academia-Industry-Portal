import type { Proficiency } from '@aip/config';
import { cn } from '@/lib/cn';

interface SkillChipProps {
  name: string;
  proficiency?: Proficiency;
  className?: string;
}

const proficiencyColors: Record<Proficiency, string> = {
  BEGINNER: 'bg-slate-400',
  INTERMEDIATE: 'bg-sky-500',
  ADVANCED: 'bg-indigo-500',
  EXPERT: 'bg-emerald-500',
};

export default function SkillChip({ name, proficiency, className }: SkillChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200',
        'dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        className,
      )}
    >
      {proficiency && (
        <span
          className={cn('w-2 h-2 rounded-full shrink-0', proficiencyColors[proficiency])}
          aria-label={proficiency.toLowerCase()}
        />
      )}
      {name}
    </span>
  );
}

export { SkillChip };
