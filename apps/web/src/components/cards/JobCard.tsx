import { Link } from 'react-router-dom';
import { FiMapPin, FiClock, FiBriefcase } from 'react-icons/fi';
import type { Job } from '@aip/types';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

interface Props {
  job: Job;
  linkPrefix?: string;
}

const workModeLabel: Record<string, string> = {
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
  ONSITE: 'On-site',
};

const employmentTypeLabel: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
};

export default function JobCard({ job, linkPrefix = '/jobs' }: Props) {
  const company = job.company as { name?: string; logoUrl?: string } | undefined;
  const companyName = company?.name ?? 'Company';
  const companyLogo = company?.logoUrl;
  return (
    <Link
      to={`${linkPrefix}/${job.id}`}
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
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0 dark:bg-indigo-900/50 dark:text-indigo-300">
            {companyName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm leading-tight truncate dark:text-slate-100 dark:group-hover:text-indigo-400">
            {job.title}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 truncate dark:text-slate-400">{companyName}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge variant="info" size="sm">{employmentTypeLabel[job.employmentType] ?? job.employmentType}</Badge>
        <Badge variant="default" size="sm">{workModeLabel[job.workMode] ?? job.workMode}</Badge>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <FiMapPin className="w-3.5 h-3.5 shrink-0" />
          {job.location}
        </span>
        {job.applicationDeadline && (
          <span className="flex items-center gap-1">
            <FiClock className="w-3.5 h-3.5 shrink-0" />
            {new Date(job.applicationDeadline).toLocaleDateString()}
          </span>
        )}
        <span className="flex items-center gap-1 ml-auto">
          <FiBriefcase className="w-3.5 h-3.5 shrink-0" />
          {job.openings} opening{job.openings !== 1 ? 's' : ''}
        </span>
      </div>
    </Link>
  );
}
