import type { Application } from '@aip/types';
import { getStudentName, getStudentEmail } from '@aip/types';
import { Link } from 'react-router-dom';
import { FiExternalLink } from 'react-icons/fi';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import MatchBadge from '@/components/ui/MatchBadge';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface Props {
  application: Application;
}

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  APPLIED: { label: 'Applied', variant: 'info' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'warning' },
  SHORTLISTED: { label: 'Shortlisted', variant: 'success' },
  INTERVIEW_SCHEDULED: { label: 'Interview', variant: 'success' },
  SELECTED: { label: 'Selected', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'default' },
};

export default function CandidateCard({ application }: Props) {
  const config = statusConfig[application.status] ?? {
    label: application.status,
    variant: 'default' as BadgeVariant,
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 dark:bg-slate-900 dark:border-slate-800">
      <Avatar name={getStudentName(application)} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 text-sm truncate dark:text-slate-100">
          {getStudentName(application)}
        </p>
        <p className="text-xs text-slate-500 truncate dark:text-slate-400">
          {getStudentEmail(application)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {application.matchScore !== null && application.matchScore !== undefined && (
          <MatchBadge score={application.matchScore} />
        )}
        <Badge variant={config.variant} size="sm">
          {config.label}
        </Badge>
        <Link
          to={`/company/applicants/${application.id}`}
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors no-underline dark:text-slate-500 dark:hover:text-indigo-400 dark:hover:bg-indigo-950"
          aria-label="View candidate"
        >
          <FiExternalLink className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
