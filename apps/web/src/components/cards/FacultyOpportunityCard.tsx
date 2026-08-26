import { Link } from 'react-router-dom';
import { FiMapPin, FiClock, FiUsers } from 'react-icons/fi';
import type { FacultyOpportunity } from '@aip/types';
import { getFacultyOppHostName } from '@aip/types';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

interface Props {
  opportunity: FacultyOpportunity;
  linkPrefix?: string;
}

const typeLabel: Record<string, string> = {
  FACULTY_INTERNSHIP: 'Faculty Internship',
  FDP: 'Faculty Dev Program',
  CONSULTANCY: 'Consultancy',
  COLLABORATIVE_RESEARCH: 'Collaborative Research',
  PROJECT: 'Project',
  APPRENTICESHIP: 'Apprenticeship',
};

const modeLabel: Record<string, string> = {
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
  ONSITE: 'On-site',
};

export default function FacultyOpportunityCard({
  opportunity,
  linkPrefix = '/faculty/opportunities',
}: Props) {
  const hostName = getFacultyOppHostName(opportunity);
  const hostLogo =
    typeof opportunity.host === 'object' && opportunity.host !== null
      ? opportunity.host.logoUrl
      : undefined;

  return (
    <Link
      to={`${linkPrefix}/${opportunity.id}`}
      className={cn(
        'group block bg-white rounded-xl border border-slate-200 shadow-sm p-5',
        'hover:border-indigo-300 hover:shadow-md transition-all duration-150 no-underline',
        'dark:bg-slate-900 dark:border-slate-800 dark:hover:border-indigo-700',
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        {hostLogo ? (
          <img
            src={hostLogo}
            alt={hostName}
            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 dark:border-slate-700"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0 dark:bg-indigo-900/50 dark:text-indigo-300">
            {hostName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm leading-tight truncate dark:text-slate-100 dark:group-hover:text-indigo-400">
            {opportunity.title}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 truncate dark:text-slate-400">
            {hostName} · {opportunity.hostType === 'INSTITUTION' ? 'Institution' : 'Industry'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge variant="info" size="sm">
          {typeLabel[opportunity.opportunityType] ?? opportunity.opportunityType}
        </Badge>
        <Badge variant="default" size="sm">{modeLabel[opportunity.mode] ?? opportunity.mode}</Badge>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
        <span className="flex items-center gap-1">
          <FiMapPin className="w-3.5 h-3.5 shrink-0" />
          {opportunity.location}
        </span>
        <span className="flex items-center gap-1">
          <FiClock className="w-3.5 h-3.5 shrink-0" />
          {new Date(opportunity.applicationDeadline).toLocaleDateString()}
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <FiUsers className="w-3.5 h-3.5 shrink-0" />
          {opportunity.openings} opening{opportunity.openings !== 1 ? 's' : ''}
        </span>
      </div>
    </Link>
  );
}
