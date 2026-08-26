import type { Interview } from '@aip/types';
import { FiCalendar, FiClock, FiVideo, FiMapPin, FiPhone } from 'react-icons/fi';
import Badge from '@/components/ui/Badge';
import { format } from 'date-fns';

interface Props {
  interview: Interview;
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const modeIcon: Record<string, React.ReactNode> = {
  ONLINE: <FiVideo className="w-3.5 h-3.5" />,
  ONSITE: <FiMapPin className="w-3.5 h-3.5" />,
  PHONE: <FiPhone className="w-3.5 h-3.5" />,
};

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  SCHEDULED: { label: 'Scheduled', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  RESCHEDULED: { label: 'Rescheduled', variant: 'warning' },
};

export default function InterviewCard({ interview }: Props) {
  const config = statusConfig[interview.status] ?? { label: interview.status, variant: 'default' as BadgeVariant };
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm truncate dark:text-slate-100">{interview.opportunityTitle}</h3>
          <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">{interview.companyName}</p>
        </div>
        <Badge variant={config.variant} size="sm" className="shrink-0">{config.label}</Badge>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <FiCalendar className="w-3.5 h-3.5 text-slate-400 shrink-0 dark:text-slate-500" />
          {format(new Date(interview.scheduledAt), 'MMM d, yyyy — h:mm a')}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <FiClock className="w-3.5 h-3.5 text-slate-400 shrink-0 dark:text-slate-500" />
          {interview.durationMinutes} minutes
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="text-slate-400 shrink-0 dark:text-slate-500">{modeIcon[interview.mode]}</span>
          {interview.mode.charAt(0) + interview.mode.slice(1).toLowerCase()}
          {interview.meetingLink && (
            <a href={interview.meetingLink} target="_blank" rel="noopener noreferrer" className="ml-1 text-indigo-600 hover:text-indigo-700 font-medium dark:text-indigo-400 dark:hover:text-indigo-300">
              Join
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
