import { useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiMapPin, FiClock, FiArrowLeft, FiCalendar, FiUsers } from 'react-icons/fi';
import type { Internship } from '@aip/types';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import Badge from '@/components/ui/Badge';
import SkillChip from '@/components/ui/SkillChip';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import ApplyModal from '@/components/features/ApplyModal';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { format } from 'date-fns';

const workModeLabel: Record<string, string> = {
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
  ONSITE: 'On-site',
};

export default function PublicInternshipDetails() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [applyOpen, setApplyOpen] = useState(false);

  // This page is mounted both publicly and inside the student shell, so the
  // "back" link has to return to whichever list the student came from.
  const inStudentArea = pathname.startsWith('/student/');
  const listPath = inStudentArea ? '/student/internships' : '/internships';
  const isStudent = user?.role === 'STUDENT';

  const { data: internship, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-internship', id],
    queryFn: () => apiGet<Internship>(`/internships/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container-page py-10">
        <div className="max-w-3xl mx-auto space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (isError || !internship) {
    return (
      <div className="container-page py-10">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  function handleApply() {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    // Previously this navigated to the applications list without ever submitting
    // anything, so "Apply now" silently did nothing. The real application is
    // created by ApplyModal, which posts to the applications endpoint.
    setApplyOpen(true);
  }

  return (
    <div className="container-page py-10">
        <Link
        to={listPath}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6 no-underline transition-colors"
      >
        <FiArrowLeft className="w-4 h-4" />
        Back to internships
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 max-w-5xl">
        <div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 mb-6">
            <div className="flex items-start gap-4 mb-4">
              {internship.company.logoUrl ? (
                <img
                  src={internship.company.logoUrl}
                  alt={internship.company.name}
                  className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-sky-600 dark:text-sky-300 font-bold text-xl shrink-0">
                  {internship.company.name.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{internship.title}</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">{internship.company.name}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              <Badge variant="info">{internship.durationMonths} month{internship.durationMonths !== 1 ? 's' : ''}</Badge>
              <Badge variant="default">{workModeLabel[internship.workMode] ?? internship.workMode}</Badge>
              {internship.stipend && (
                <Badge variant="success">
                  {internship.currency ?? '₹'}{internship.stipend.toLocaleString()}/mo stipend
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <FiMapPin className="w-4 h-4 text-slate-400 shrink-0" />
                {internship.location}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <FiUsers className="w-4 h-4 text-slate-400 shrink-0" />
                {internship.openings} seat{internship.openings !== 1 ? 's' : ''}
              </div>
              {internship.applicationDeadline && (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <FiCalendar className="w-4 h-4 text-slate-400 shrink-0" />
                  {format(new Date(internship.applicationDeadline), 'MMM d, yyyy')}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">About the internship</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{internship.description}</p>
          </div>

          {internship.requiredSkills.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Required Skills</h2>
              <div className="flex flex-wrap gap-2">
                {internship.requiredSkills.map((s) => (
                  <SkillChip key={s.id} name={s.name} />
                ))}
              </div>
            </div>
          )}

          {internship.preferredSkills.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Preferred Skills</h2>
              <div className="flex flex-wrap gap-2">
                {internship.preferredSkills.map((s) => (
                  <SkillChip key={s.id} name={s.name} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            {/* Only students can hold an application, so other signed-in roles are
                told why the button is absent rather than being handed one that
                the API would reject. */}
            {isAuthenticated && !isStudent ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                Applications can only be submitted from a student account.
              </p>
            ) : (
              <>
                <Button className="w-full mb-3" onClick={handleApply}>
                  {isAuthenticated ? 'Apply now' : 'Sign in to apply'}
                </Button>
                {!isAuthenticated && (
                  <p className="text-xs text-center text-slate-400">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-indigo-600 font-medium">
                      Register
                    </Link>
                  </p>
                )}
              </>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Eligibility</h3>
            {internship.minCgpa && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <FiClock className="w-4 h-4 text-slate-400 shrink-0" />
                Min CGPA: {internship.minCgpa}
              </div>
            )}
            {internship.eligibleBranches.length > 0 && (
              <div className="text-sm text-slate-600 dark:text-slate-300">
                <p className="font-medium text-slate-700 dark:text-slate-200 mb-1.5">Eligible branches</p>
                <div className="flex flex-wrap gap-1.5">
                  {internship.eligibleBranches.map((b) => (
                    <Badge key={b} variant="default" size="sm">{b}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isStudent && (
        <ApplyModal
          open={applyOpen}
          onClose={() => setApplyOpen(false)}
          opportunityType="INTERNSHIP"
          opportunityId={internship.id}
          opportunityTitle={internship.title}
        />
      )}
    </div>
  );
}
