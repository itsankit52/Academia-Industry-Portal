/**
 * Phase 15B — Student Faculty/Institution Opportunity Detail
 *
 * Single opportunity page: full description, required expertise, host info,
 * and apply / withdraw actions.
 */
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  FiArrowLeft,
  FiTarget,
  FiMapPin,
  FiClock,
  FiUsers,
  FiBriefcase,
  FiCheckCircle,
  FiXCircle,
  FiMail,
  FiAward,
} from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import {
  useStudentFacultyOpportunity,
  useApplyToFacultyOpportunity,
  useWithdrawFacultyApplication as useWithdrawFacultyOpportunity,
} from '@/hooks/queries/useStudentFacultyOpportunities';

const typeLabel: Record<string, string> = {
  FACULTY_INTERNSHIP: 'Internship',
  FDP: 'FDP',
  CONSULTANCY: 'Consultancy',
  COLLABORATIVE_RESEARCH: 'Research',
  PROJECT: 'Project',
  APPRENTICESHIP: 'Apprenticeship',
};

function matchScoreColor(score?: number) {
  if (score === undefined) return 'bg-slate-100 text-slate-500';
  if (score >= 75)
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (score >= 40) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
}

export default function StudentFacultyOpportunityDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [coverLetter, setCoverLetter] = useState('');
  const [showApplyForm, setShowApplyForm] = useState(false);

  const { data: opp, isLoading, isError, refetch } = useStudentFacultyOpportunity(id ?? '');
  const applyMutation = useApplyToFacultyOpportunity();
  const withdrawMutation = useWithdrawFacultyOpportunity();

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !opp) {
    return (
      <div className="container-page py-8">
        <ErrorState onRetry={() => void refetch()} title="Could not load this opportunity" />
      </div>
    );
  }

  const deadline = new Date(opp.applicationDeadline);
  const isExpired = deadline < new Date();
  const isApplied = opp.hasApplied;
  const isWithdrawn = opp.applicationStatus === 'WITHDRAWN';
  const isEngaged = [
    'SELECTED',
    'OFFER_ACCEPTED',
    'INTERNSHIP_STARTED',
    'ONGOING',
    'COMPLETED',
  ].includes(opp.applicationStatus ?? '');
  const canApply = !isApplied && !isExpired;
  const canWithdraw = isApplied && !isWithdrawn && !isEngaged;

  function handleApply() {
    if (!opp) return;
    applyMutation.mutate(
      { opportunityId: opp.id, coverLetter: coverLetter || undefined },
      {
        onSuccess: () => {
          setShowApplyForm(false);
          setCoverLetter('');
        },
      },
    );
  }

  function handleWithdraw() {
    if (!opp) return;
    if (!window.confirm('Withdraw your application? This cannot be undone.')) return;
    withdrawMutation.mutate(opp.id);
  }

  return (
    <div className="container-page py-8 space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <FiArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge variant={opp.hostType === 'COMPANY' ? 'info' : 'default'} size="md">
            {typeLabel[opp.opportunityType] ?? opp.opportunityType}
          </Badge>
          <Badge variant="default" size="md" className="capitalize">
            {opp.hostType.toLowerCase()}
          </Badge>
          {opp.matchScore !== undefined && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${matchScoreColor(opp.matchScore)}`}
            >
              <FiTarget className="w-3 h-3" />
              {opp.matchScore}% skill match
            </span>
          )}
          {isApplied && (
            <Badge variant="success" size="md" className="flex items-center gap-1">
              <FiCheckCircle className="w-3.5 h-3.5" />
              {opp.applicationStatus === 'WITHDRAWN'
                ? 'Withdrawn'
                : `Applied: ${opp.applicationStatus}`}
            </Badge>
          )}
        </div>
        <PageHeader title={opp.title} />
      </div>

      {/* Host + meta */}
      <Card>
        <Card.Body className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            {opp.hostType === 'COMPANY' ? <FiBriefcase /> : <FiUsers />}
            {opp.host.name}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Location</span>
              <p className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                <FiMapPin className="w-3.5 h-3.5" /> {opp.location || '—'}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Mode</span>
              <p className="font-medium text-slate-900 dark:text-slate-100 capitalize">
                {opp.mode.toLowerCase()}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Duration</span>
              <p className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                <FiClock className="w-3.5 h-3.5" />
                {opp.durationWeeks ? `${opp.durationWeeks} weeks` : '—'}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Openings</span>
              <p className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                <FiUsers className="w-3.5 h-3.5" /> {opp.openings}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Apply by</span>
              <p
                className={`font-medium flex items-center gap-1 ${
                  isExpired
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                <FiClock className="w-3.5 h-3.5" />
                {format(deadline, 'MMM d, yyyy')}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Posted</span>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {format(new Date(opp.createdAt), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Description */}
      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Description
          </h2>
        </Card.Header>
        <Card.Body>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {opp.description}
          </p>
        </Card.Body>
      </Card>

      {/* Required & preferred expertise */}
      {(opp.requiredExpertise.length > 0 || opp.preferredQualifications.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {opp.requiredExpertise.length > 0 && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                  <FiTarget className="w-4 h-4" /> Required Expertise
                </h2>
              </Card.Header>
              <Card.Body>
                <div className="flex flex-wrap gap-1.5">
                  {opp.requiredExpertise.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}

          {opp.preferredQualifications.length > 0 && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                  <FiAward className="w-4 h-4" /> Preferred
                </h2>
              </Card.Header>
              <Card.Body>
                <div className="flex flex-wrap gap-1.5">
                  {opp.preferredQualifications.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-xs font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}
        </div>
      )}

      {/* Action card */}
      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Your Application
          </h2>
        </Card.Header>
        <Card.Body>
          {isExpired && !isApplied && (
            <EmptyState
              icon={<FiXCircle />}
              title="Application deadline has passed"
              description="This opportunity is no longer accepting applications."
            />
          )}

          {!isExpired && !isApplied && !showApplyForm && (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Interested in this opportunity? Submit your application now.
              </p>
              <Button onClick={() => setShowApplyForm(true)} iconLeft={<FiCheckCircle />} size="md">
                Apply Now
              </Button>
            </div>
          )}

          {!isExpired && !isApplied && showApplyForm && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Cover Letter (optional)
                </label>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={5}
                  maxLength={1000}
                  placeholder="Tell the host why you're a good fit for this opportunity…"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400 mt-1">{coverLetter.length}/1000 characters</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={handleApply}
                  loading={applyMutation.isPending}
                  disabled={applyMutation.isPending}
                  iconLeft={<FiMail />}
                >
                  Submit Application
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowApplyForm(false);
                    setCoverLetter('');
                  }}
                  disabled={applyMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {isApplied && !isWithdrawn && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                You applied on{' '}
                <span className="font-medium">
                  {/* Submitted timestamp not available in detail view, but shown on the list. */}
                  (see your applications list)
                </span>
                . The host will review your application.
              </p>
              {canWithdraw && (
                <Button
                  variant="ghost"
                  onClick={handleWithdraw}
                  loading={withdrawMutation.isPending}
                  disabled={withdrawMutation.isPending}
                  iconLeft={<FiXCircle />}
                  className="text-rose-600 dark:text-rose-400"
                >
                  Withdraw Application
                </Button>
              )}
            </div>
          )}

          {isWithdrawn && (
            <div className="text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                You have withdrawn your application. You can no longer apply to this opportunity.
              </p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Helpful link */}
      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        <Link to="/student/faculty-opportunities" className="hover:underline">
          ← Back to all opportunities
        </Link>
      </p>
    </div>
  );
}
