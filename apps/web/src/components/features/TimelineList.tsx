import { format } from 'date-fns';
import type { TimelineEntry } from '@aip/types';
import Badge from '@/components/ui/Badge';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  APPLIED: { label: 'Applied', variant: 'info' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'warning' },
  SHORTLISTED: { label: 'Shortlisted', variant: 'success' },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', variant: 'success' },
  SELECTED: { label: 'Selected', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'default' },
  INTERNSHIP_STARTED: { label: 'Internship Started', variant: 'success' },
  ONGOING: { label: 'Ongoing', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  OFFER_ACCEPTED: { label: 'Offer Accepted', variant: 'success' },
  OFFER_REJECTED: { label: 'Offer Declined', variant: 'danger' },
};

interface Props {
  timeline: TimelineEntry[];
}

export default function TimelineList({ timeline }: Props) {
  return (
    <ol className="relative border-l border-slate-200 space-y-6 pl-4 ml-2 dark:border-slate-800">
      {timeline.map((entry, i) => {
        const config = statusConfig[entry.status] ?? {
          label: entry.status,
          variant: 'default' as BadgeVariant,
        };
        return (
          <li key={i} className="relative pl-4">
            <span className="absolute -left-[9px] top-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-950" />
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={config.variant} size="sm">
                {config.label}
              </Badge>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {format(new Date(entry.at), 'MMM d, yyyy — h:mm a')}
              </span>
            </div>
            {entry.note && (
              <p className="text-xs text-slate-600 mt-1 dark:text-slate-400">{entry.note}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
