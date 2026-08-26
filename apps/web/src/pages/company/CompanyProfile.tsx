import { Link } from 'react-router-dom';
import { FiEdit2, FiGlobe, FiPhone, FiMapPin, FiUsers, FiCalendar, FiCheckCircle } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useCompanyProfile } from '@/hooks/queries/useCompanyProfile';

export default function CompanyProfile() {
  const { data: profile, isLoading, isError, refetch } = useCompanyProfile();

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Company Profile"
        subtitle="Your public company information."
        actions={
          <Link to="/company/profile/edit">
            <Button size="sm" variant="outline" iconLeft={<FiEdit2 className="w-4 h-4" />}>
              Edit Profile
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonCard className="h-32" />
          <SkeletonCard className="h-48" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <Card.Body>
              <div className="flex items-center gap-4">
                <Avatar src={profile?.logoUrl} name={profile?.companyName} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{profile?.companyName}</h2>
                    {profile?.verifiedAt && (
                      <FiCheckCircle className="w-5 h-5 text-emerald-500 shrink-0" title="Verified" />
                    )}
                  </div>
                  {profile?.industry && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{profile.industry}</p>}
                </div>
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">About</h3></Card.Header>
            <Card.Body>
              {profile?.description ? (
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{profile.description}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">No description added yet.</p>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Contact & Location</h3></Card.Header>
            <Card.Body>
              <dl className="space-y-3">
                {profile?.website && (
                  <div className="flex items-center gap-3">
                    <FiGlobe className="w-4 h-4 text-slate-400 shrink-0" />
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">{profile.website}</a>
                  </div>
                )}
                {profile?.phone && (
                  <div className="flex items-center gap-3">
                    <FiPhone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{profile.phone}</span>
                  </div>
                )}
                {profile?.location && (
                  <div className="flex items-center gap-3">
                    <FiMapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{profile.location}</span>
                  </div>
                )}
                {!profile?.website && !profile?.phone && !profile?.location && (
                  <p className="text-sm text-slate-400 italic">No contact information added.</p>
                )}
              </dl>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header><h3 className="font-semibold text-slate-900 dark:text-slate-100">Team & Founded</h3></Card.Header>
            <Card.Body>
              <dl className="space-y-3">
                {profile?.companySize && (
                  <div className="flex items-center gap-3">
                    <FiUsers className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{profile.companySize} employees</span>
                  </div>
                )}
                {profile?.foundedYear && (
                  <div className="flex items-center gap-3">
                    <FiCalendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Founded {profile.foundedYear}</span>
                  </div>
                )}
                {!profile?.companySize && !profile?.foundedYear && (
                  <p className="text-sm text-slate-400 italic">No team information added.</p>
                )}
              </dl>
            </Card.Body>
          </Card>
        </div>
      )}
    </div>
  );
}
