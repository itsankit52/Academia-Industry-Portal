import { Link } from 'react-router-dom';
import { FiExternalLink } from 'react-icons/fi';
import type { Application } from '@aip/types';
import { getOpportunityTitle, getCompanyName } from '@aip/types';
import Badge from '@/components/ui/Badge';
import { format } from 'date-fns';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface Props {
  application: Application;
}

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  APPLIED: { label: 'Applied', variant: 'info' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'warning' },
  SHORTLISTED: { label: 'Shortlisted', variant: 'success' },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', variant: 'success' },
  SELECTED: { label: 'Selected', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'default' },
};

export default function ApplicationCard({ application }: Props) {
  const config = statusConfig[application.status] ?? { label: application.status, variant: 'default' as BadgeVariant };
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm truncate dark:text-slate-100">{getOpportunityTitle(application)}</h3>
          <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">{getCompanyName(application)}</p>
        </div>
        <Badge variant={config.variant} size="sm" className="shrink-0">{config.label}</Badge>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          Applied {format(new Date(application.createdAt), 'MMM d, yyyy')}
        </span>
        <Link
          to={`/student/applications/${application.id}`}
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium no-underline dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          View <FiExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

type BadgeProps2 = React.ComponentProps<typeof Badge>;
export type { BadgeProps2 };
