import { FiBriefcase, FiBook, FiUsers, FiCalendar } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import CandidateCard from '@/components/cards/CandidateCard';
import InterviewCard from '@/components/cards/InterviewCard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useCompanyDashboard } from '@/hooks/queries/useCompanyDashboard';
import { useCompanyProfile } from '@/hooks/queries/useCompanyProfile';

export default function CompanyDashboard() {
  const { data: profile } = useCompanyProfile();
  const { data, isLoading, isError, refetch } = useCompanyDashboard();

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title={`Welcome back${profile?.companyName ? `, ${profile.companyName}` : ''}`}
        subtitle="Here's what's happening with your hiring pipeline."
        actions={
          <Link to="/company/jobs/new">
            <Button size="sm" iconLeft={<FiBriefcase className="w-4 h-4" />}>
              Post a Job
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              label="Active Jobs"
              value={data?.activeJobsCount ?? 0}
              icon={<FiBriefcase className="w-5 h-5" />}
            />
            <StatCard
              label="Active Internships"
              value={data?.activeInternshipsCount ?? 0}
              icon={<FiBook className="w-5 h-5" />}
            />
            <StatCard
              label="Total Applicants"
              value={data?.applicantsCount ?? 0}
              icon={<FiUsers className="w-5 h-5" />}
            />
            <StatCard
              label="Interviews Scheduled"
              value={data?.interviewsCount ?? 0}
              icon={<FiCalendar className="w-5 h-5" />}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Recent Applicants</h2>
              <Link to="/company/applicants" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium no-underline">
                View all
              </Link>
            </div>
          </Card.Header>
          <Card.Body className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="h-16" />)
            ) : !data?.recentApplicants?.length ? (
              <EmptyState title="No applicants yet" description="Post a job to start receiving applications." />
            ) : (
              data.recentApplicants.slice(0, 6).map((app) => (
                <CandidateCard key={app.id} application={app} />
              ))
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Upcoming Interviews</h2>
              <Link to="/company/interviews" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium no-underline">
                View all
              </Link>
            </div>
          </Card.Header>
          <Card.Body className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="h-24" />)
            ) : !data?.upcomingInterviews?.length ? (
              <EmptyState title="No upcoming interviews" description="Schedule interviews from the Applicants page." />
            ) : (
              data.upcomingInterviews.slice(0, 5).map((iv) => (
                <InterviewCard key={iv.id} interview={iv} />
              ))
            )}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
