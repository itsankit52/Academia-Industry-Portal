import { Link } from 'react-router-dom';
import { FiBriefcase, FiActivity, FiCalendar, FiUser, FiCompass, FiUsers } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ApplicationCard from '@/components/cards/ApplicationCard';
import InterviewCard from '@/components/cards/InterviewCard';
import { useFacultyDashboard } from '@/hooks/queries/useFacultyDashboard';
import { useAuthStore } from '@/store/auth';

export default function FacultyDashboard() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, refetch } = useFacultyDashboard();

  const namePart = user?.email.split('@')[0] ?? 'Faculty';

  return (
    <div className="container-page py-8 space-y-8">
      <PageHeader
        title={`Welcome, ${namePart}`}
        subtitle="Your research, consultancy and development activity at a glance."
      />

      {isError && <ErrorState onRetry={() => void refetch()} />}

      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="My Applications"
              value={data.totalApplications}
              icon={<FiBriefcase />}
            />
            <StatCard label="Active" value={data.activeApplications} icon={<FiActivity />} />
            <StatCard
              label="Upcoming Interviews"
              value={data.upcomingInterviewsCount}
              icon={<FiCalendar />}
            />
            <StatCard
              label="Profile Completion"
              value={`${data.profileCompletion}%`}
              icon={<FiUser />}
            />
          </div>

          {/* Quick actions */}
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <QuickActionCard
                to="/faculty/opportunities"
                icon={<FiCompass className="w-5 h-5" />}
                label="Browse Opportunities"
                description="FDPs, consultancy, projects"
              />
              <QuickActionCard
                to="/faculty/events"
                icon={<FiCalendar className="w-5 h-5" />}
                label="My Events"
                description="Host & attend events"
              />
              <QuickActionCard
                to="/faculty/mentorship"
                icon={<FiUsers className="w-5 h-5" />}
                label="Mentorship"
                description="Find mentors or host one"
              />
              <QuickActionCard
                to="/faculty/profile"
                icon={<FiUser className="w-5 h-5" />}
                label="My Profile"
                description="Update your profile"
              />
              <QuickActionCard
                to="/faculty/applications"
                icon={<FiBriefcase className="w-5 h-5" />}
                label="My Applications"
                description="Track your applications"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Recent Applications
              </h2>
              {data.recentApplications.length === 0 ? (
                <EmptyState
                  title="No applications yet"
                  description="Browse faculty opportunities and apply to get started."
                />
              ) : (
                <div className="space-y-3">
                  {data.recentApplications.slice(0, 5).map((app) => (
                    <ApplicationCard key={app.id} application={app} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Upcoming Interviews
              </h2>
              {data.upcomingInterviews.length === 0 ? (
                <EmptyState
                  title="No upcoming interviews"
                  description="Interviews will appear here once scheduled."
                />
              ) : (
                <div className="space-y-3">
                  {data.upcomingInterviews.slice(0, 5).map((iv) => (
                    <InterviewCard key={iv.id} interview={iv} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function QuickActionCard({
  to,
  icon,
  label,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center text-center gap-2 p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all no-underline dark:bg-slate-900 dark:border-slate-800 dark:hover:border-indigo-700"
    >
      <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
      </div>
    </Link>
  );
}
