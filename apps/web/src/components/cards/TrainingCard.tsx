import type { TrainingProgram } from '@aip/types';
import { FiExternalLink, FiCalendar, FiClock } from 'react-icons/fi';
import SkillChip from '@/components/ui/SkillChip';
import Badge from '@/components/ui/Badge';
import { format } from 'date-fns';

interface Props {
  training: TrainingProgram;
}

export default function TrainingCard({ training }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm leading-tight dark:text-slate-100">{training.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">{training.provider}</p>
        </div>
        <Badge variant={training.status === 'ACTIVE' ? 'success' : 'default'} size="sm" className="shrink-0">
          {training.status === 'ACTIVE' ? 'Active' : 'Archived'}
        </Badge>
      </div>

      <p className="text-xs text-slate-600 line-clamp-2 mb-3 dark:text-slate-400">{training.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {training.skills.slice(0, 3).map((s) => (
          <SkillChip key={s.id} name={s.name} />
        ))}
        {training.skills.length > 3 && (
          <span className="text-xs text-slate-400 self-center dark:text-slate-500">+{training.skills.length - 3}</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <FiClock className="w-3.5 h-3.5" />
            {training.durationWeeks}w
          </span>
          {training.registrationDeadline && (
            <span className="flex items-center gap-1">
              <FiCalendar className="w-3.5 h-3.5" />
              {format(new Date(training.registrationDeadline), 'MMM d')}
            </span>
          )}
        </div>
        <a
          href={training.registrationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium no-underline dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Register <FiExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
