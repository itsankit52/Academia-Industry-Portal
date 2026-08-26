import { FiBriefcase, FiActivity, FiCalendar, FiUser } from 'react-icons/fi';
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
            <StatCard label="My Applications" value={data.totalApplications} icon={<FiBriefcase />} />
            <StatCard label="Active" value={data.activeApplications} icon={<FiActivity />} />
            <StatCard label="Upcoming Interviews" value={data.upcomingInterviewsCount} icon={<FiCalendar />} />
            <StatCard label="Profile Completion" value={`${data.profileCompletion}%`} icon={<FiUser />} />
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
