import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCalendar, FiClock, FiMapPin, FiUsers } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ApplyModal from '@/components/features/ApplyModal';
import { useFacultyOpportunity } from '@/hooks/queries/useFacultyOpportunities';
import { getFacultyOppHostName } from '@aip/types';

const typeLabel: Record<string, string> = {
  FACULTY_INTERNSHIP: 'Faculty Internship',
  FDP: 'Faculty Development Program',
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

export default function FacultyOpportunityDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [applyOpen, setApplyOpen] = useState(false);

  const { data: opp, isLoading, isError, refetch } = useFacultyOpportunity(id ?? '');

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError || !opp) {
    return (
      <div className="container-page py-8">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  const facultyCanApply = opp.targetRoles.includes('FACULTY');

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title={opp.title}
        subtitle={`${getFacultyOppHostName(opp)} · ${opp.hostType === 'INSTITUTION' ? 'Institution' : 'Industry'}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            iconLeft={<FiArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/faculty/opportunities')}
          >
            Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-4">
          <Card>
            <Card.Header>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{typeLabel[opp.opportunityType] ?? opp.opportunityType}</Badge>
                <Badge variant="default">{modeLabel[opp.mode] ?? opp.mode}</Badge>
                <Badge variant={opp.status === 'PUBLISHED' ? 'success' : 'default'}>{opp.status}</Badge>
              </div>
            </Card.Header>
            <Card.Body className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <FiMapPin className="w-4 h-4 text-slate-400" /> {opp.location}
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <FiCalendar className="w-4 h-4 text-slate-400" /> Apply by{' '}
                  {format(new Date(opp.applicationDeadline), 'MMM d, yyyy')}
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <FiUsers className="w-4 h-4 text-slate-400" /> {opp.openings} opening
                  {opp.openings !== 1 ? 's' : ''}
                </div>
                {opp.durationWeeks !== undefined && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <FiClock className="w-4 h-4 text-slate-400" /> {opp.durationWeeks} week
                    {opp.durationWeeks !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Description
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {opp.description}
                </p>
              </div>

              {opp.requiredExpertise.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    Required Expertise
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {opp.requiredExpertise.map((s) => (
                      <Badge key={s} variant="info" size="sm">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {opp.preferredQualifications.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    Preferred Qualifications
                  </h3>
                  <ul className="text-sm text-slate-700 dark:text-slate-300 list-disc list-inside space-y-1">
                    {opp.preferredQualifications.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              {opp.stipend?.amount !== undefined && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    Stipend
                  </h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {opp.stipend.amount.toLocaleString()} {opp.stipend.currency}
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>

        <Card>
          <Card.Header>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Apply
            </h3>
          </Card.Header>
          <Card.Body className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Target Roles: {opp.targetRoles.join(', ')}
            </p>
            {facultyCanApply && opp.status === 'PUBLISHED' ? (
              <Button className="w-full" onClick={() => setApplyOpen(true)}>
                Apply Now
              </Button>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {opp.status !== 'PUBLISHED'
                  ? 'This opportunity is not open for applications.'
                  : 'This opportunity is not open to faculty applicants.'}
              </p>
            )}
          </Card.Body>
        </Card>
      </div>

      {applyOpen && (
        <ApplyModal
          open
          onClose={() => setApplyOpen(false)}
          opportunityType={opp.opportunityType}
          opportunityId={opp.id}
          opportunityTitle={opp.title}
        />
      )}
    </div>
  );
}
