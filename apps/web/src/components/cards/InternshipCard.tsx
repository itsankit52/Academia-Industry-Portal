import { Link } from 'react-router-dom';
import { FiMapPin, FiClock, FiCalendar } from 'react-icons/fi';
import type { Internship } from '@aip/types';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

interface Props {
  internship: Internship;
  linkPrefix?: string;
}

const workModeLabel: Record<string, string> = {
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
  ONSITE: 'On-site',
};

export default function InternshipCard({ internship, linkPrefix = '/internships' }: Props) {
  const company = internship.company as { name?: string; logoUrl?: string } | undefined;
  const companyName = company?.name ?? 'Company';
  const companyLogo = company?.logoUrl;
  return (
    <Link
      to={`${linkPrefix}/${internship.id}`}
      className={cn(
        'group block bg-white rounded-xl border border-slate-200 shadow-sm p-5',
        'hover:border-indigo-300 hover:shadow-md transition-all duration-150 no-underline',
        'dark:bg-slate-900 dark:border-slate-800 dark:hover:border-indigo-700',
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        {companyLogo ? (
          <img
            src={companyLogo}
            alt={companyName}
            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 dark:border-slate-700"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-sm shrink-0 dark:bg-sky-900/50 dark:text-sky-300">
            {companyName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm leading-tight truncate dark:text-slate-100 dark:group-hover:text-indigo-400">
            {internship.title}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 truncate dark:text-slate-400">{companyName}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge variant="info" size="sm">{internship.durationMonths}mo</Badge>
        <Badge variant="default" size="sm">{workModeLabel[internship.workMode] ?? internship.workMode}</Badge>
        {internship.stipend && (
          <Badge variant="success" size="sm">
            {internship.currency ?? '₹'}{internship.stipend.toLocaleString()}/mo
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <FiMapPin className="w-3.5 h-3.5 shrink-0" />
          {internship.location}
        </span>
        {internship.applicationDeadline && (
          <span className="flex items-center gap-1">
            <FiClock className="w-3.5 h-3.5 shrink-0" />
            {new Date(internship.applicationDeadline).toLocaleDateString()}
          </span>
        )}
        <span className="flex items-center gap-1 ml-auto">
          <FiCalendar className="w-3.5 h-3.5 shrink-0" />
          {internship.openings} seat{internship.openings !== 1 ? 's' : ''}
        </span>
      </div>
    </Link>
  );
}
