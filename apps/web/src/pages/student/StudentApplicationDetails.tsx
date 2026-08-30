import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiArrowLeft, FiExternalLink, FiUser, FiAward, FiMessageCircle, FiCheck, FiX, FiClock, FiDollarSign, FiCalendar, FiFileText, FiDownload } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import MatchBadge from '@/components/ui/MatchBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import TimelineList from '@/components/features/TimelineList';
import { useApplication } from '@/hooks/queries/useApplication';
import { useWithdrawApplication } from '@/hooks/queries/useWithdrawApplication';
import { useInterimReports } from '@/hooks/queries/useInterimReports';
import { useDownloadCertificate } from '@/hooks/queries/useDownloadCertificate';
import { useApplicationMentor } from '@/hooks/queries/usePhase5B';
import { useOfferResponse } from '@/hooks/queries/useOfferResponse';
import { useWithdrawOffer } from '@/hooks/queries/useWithdrawOffer';
import { useDownloadOfferLetter } from '@/hooks/queries/useDownloadOfferLetter';
import { getOpportunityTitle, getCompanyName, getOpportunityId, getResumeUrl } from '@aip/types';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  APPLIED: { label: 'Applied', variant: 'info' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'warning' },
  SHORTLISTED: { label: 'Shortlisted', variant: 'success' },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', variant: 'success' },
  SELECTED: { label: 'Selected', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'default' },
  INTERNSHIP_STARTED: { label: 'Internship Started', variant: 'success' },
  ONGOING: { label: 'Ongoing', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  OFFER_ACCEPTED: { label: 'Offer Accepted', variant: 'success' },
  OFFER_REJECTED: { label: 'Offer Declined', variant: 'danger' },
  WITHDRAWAL_REQUESTED: { label: 'Withdrawal Requested', variant: 'warning' },
};

// Terminal statuses — no further action (e.g. Withdraw) is offered.
const TERMINAL_STATUSES = new Set(['REJECTED', 'WITHDRAWN', 'COMPLETED', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'WITHDRAWAL_REQUESTED']);

export default function StudentApplicationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAcceptOffer, setShowAcceptOffer] = useState(false);
  const [showRejectOffer, setShowRejectOffer] = useState(false);
  const [showWithdrawOffer, setShowWithdrawOffer] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');

  const { data: application, isLoading, isError, refetch } = useApplication(id ?? '');
  const withdraw = useWithdrawApplication();
  const reportsQ = useInterimReports(id ?? '');
  const downloadCert = useDownloadCertificate(id ?? '');
  const mentorQ = useApplicationMentor(id ?? '');
  const offerResponse = useOfferResponse(id ?? '');
  const withdrawOffer = useWithdrawOffer(id ?? '');
  const downloadOfferLetter = useDownloadOfferLetter(id ?? '');

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError || !application) {
    return (
      <div className="container-page py-8">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  const cfg = statusConfig[application.status] ?? {
    label: application.status,
    variant: 'default' as BadgeVariant,
  };
  const canWithdraw = !TERMINAL_STATUSES.has(application.status);
  // Phase 6B: Student can accept/reject only while SELECTED and not expired.
  const now = new Date();
  const offerExpired =
    application.status === 'SELECTED' &&
    application.offerExpiresAt != null &&
    new Date(application.offerExpiresAt).getTime() < now.getTime();
  const canRespondToOffer = application.status === 'SELECTED' && !offerExpired;
  const canWithdrawOffer = application.status === 'OFFER_ACCEPTED';
  const isInternshipActive = ['INTERNSHIP_STARTED', 'ONGOING'].includes(application.status);
  const isCompleted = application.status === 'COMPLETED';
  const canShowCertificate =
    application.opportunityType === 'INTERNSHIP' &&
    ['ONGOING', 'COMPLETED'].includes(application.status) &&
    (reportsQ.data?.items.length ?? 0) > 0;
  const hasOfferDetails =
    application.offerDetails != null &&
    (application.offerDetails.offeredSalary !== undefined ||
      application.offerDetails.joiningDate !== undefined);
  const hasOfferLetter = application.offerLetter != null;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Application Details"
        subtitle={getOpportunityTitle(application)}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<FiArrowLeft className="w-4 h-4" />}
              onClick={() => navigate('/student/applications')}
            >
              Back
            </Button>
            {['SELECTED', 'INTERNSHIP_STARTED', 'ONGOING', 'COMPLETED'].includes(
              application.status,
            ) && (
              <Link
                to={`/student/applications/${application.id}/reports`}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 no-underline dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiFileText className="w-4 h-4" /> Progress Reports
              </Link>
            )}
            {canShowCertificate && (
              <Button
                size="sm"
                iconLeft={<FiDownload className="w-4 h-4" />}
                loading={downloadCert.isPending}
                onClick={() => downloadCert.mutate()}
              >
                {isCompleted ? 'Download Certificate' : 'Preview Certificate'}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-4">
          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Overview</h2>
            </Card.Header>
            <Card.Body className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
                {application.matchScore !== undefined && (
                  <MatchBadge score={application.matchScore} />
                )}
                <Badge variant="default" size="sm">{application.opportunityType}</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Company</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{getCompanyName(application)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Applied On</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    {format(new Date(application.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Last Updated</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    {format(new Date(application.updatedAt), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>

              {application.coverLetter && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Cover Letter</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    {application.coverLetter}
                  </p>
                </div>
              )}

              {getResumeUrl(application) && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Resume</p>
                  <a
                    href={getResumeUrl(application)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium no-underline"
                  >
                    View Resume <FiExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {canWithdraw && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowWithdraw(true)}
                  >
                    Withdraw Application
                  </Button>
                </div>
              )}
              {/* Phase 6A + 6B: Offer card — shown whenever SELECTED */}
              {(application.status === 'SELECTED' || application.offerDetails || application.offerExpiresAt) && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                    <FiAward className="w-3.5 h-3.5" />
                    Placement Offer
                  </p>

                  {/* Offer details display */}
                  {hasOfferDetails && application.offerDetails && (
                    <div className="space-y-1.5 mb-3">
                      {application.offerDetails.offeredSalary !== undefined && (
                        <div className="flex items-center gap-2 text-sm">
                          <FiDollarSign className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-600 dark:text-slate-400">Package:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {application.offerDetails.currency ?? 'INR'}{' '}
                            {application.offerDetails.offeredSalary.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {application.offerDetails.joiningDate && (
                        <div className="flex items-center gap-2 text-sm">
                          <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-600 dark:text-slate-400">Joining:</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {format(new Date(application.offerDetails.joiningDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                      {application.offerDetails.offerTerms && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded p-2">
                          {application.offerDetails.offerTerms}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Offer expiry deadline */}
                  {application.offerExpiresAt && (
                    <div className={`flex items-center gap-1.5 text-xs mb-2 ${
                      offerExpired
                        ? 'text-red-600 dark:text-red-400 font-medium'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      <FiClock className="w-3.5 h-3.5" />
                      {offerExpired ? (
                        <span>⚠️ Offer expired on {format(new Date(application.offerExpiresAt), 'MMM d, yyyy')}</span>
                      ) : (
                        <span>Respond by {format(new Date(application.offerExpiresAt), 'MMM d, yyyy')}</span>
                      )}
                    </div>
                  )}

                  {/* Offer letter download */}
                  {hasOfferLetter && application.offerLetter && (
                    <div className="mb-3">
                      <Button
                        variant="outline"
                        size="sm"
                        iconLeft={<FiFileText className="w-4 h-4" />}
                        loading={downloadOfferLetter.isPending}
                        onClick={() => downloadOfferLetter.mutate()}
                      >
                        View Offer Letter
                      </Button>
                    </div>
                  )}

                  {/* Phase 6A: Accept/Decline buttons */}
                  {canRespondToOffer && (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        iconLeft={<FiCheck className="w-4 h-4" />}
                        onClick={() => setShowAcceptOffer(true)}
                      >
                        Accept Offer
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        iconLeft={<FiX className="w-4 h-4" />}
                        onClick={() => setShowRejectOffer(true)}
                      >
                        Decline Offer
                      </Button>
                    </div>
                  )}

                  {/* Expired state */}
                  {application.status === 'SELECTED' && offerExpired && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        ⏳ The offer deadline has passed. The company has not received a response.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Phase 6B: Withdrawal request for accepted offers */}
              {canWithdrawOffer && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowWithdrawOffer(true)}
                  >
                    Request Withdrawal
                  </Button>
                </div>
              )}

              {/* Phase 6B: Withdrawal pending */}
              {application.status === 'WITHDRAWAL_REQUESTED' && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      ⏳ Withdrawal request submitted
                    </p>
                    {application.withdrawalRequestedAt && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Requested on {format(new Date(application.withdrawalRequestedAt), 'MMM d, yyyy')}
                      </p>
                    )}
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      The company will review your request and take appropriate action.
                    </p>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Opportunity
              </h2>
            </Card.Header>
            <Card.Body>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{getOpportunityTitle(application)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{getCompanyName(application)}</p>
                </div>
                <Link
                  to={`/student/${application.opportunityType === 'JOB' ? 'jobs' : 'internships'}/${getOpportunityId(application)}`}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium no-underline shrink-0"
                >
                  View <FiExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </Card.Body>
          </Card>

          {/* Mentor card (Phase 5B) */}
          {application.opportunityType === 'INTERNSHIP' && isInternshipActive && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                  <FiUser className="w-4 h-4" /> Your Mentor
                </h2>
              </Card.Header>
              <Card.Body>
                {mentorQ.isLoading ? (
                  <p className="text-sm text-slate-500">Loading mentor info...</p>
                ) : mentorQ.data ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {mentorQ.data.fullName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {mentorQ.data.email}
                        </p>
                      </div>
                    </div>
                    {mentorQ.data.expertise && mentorQ.data.expertise.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {mentorQ.data.expertise.map((e) => (
                          <span
                            key={e}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    )}
                    {mentorQ.data.yearsExperience !== undefined && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {mentorQ.data.yearsExperience} years experience
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No mentor has been assigned yet.
                  </p>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Internship completion card (Phase 5B) */}
          {isCompleted && application.opportunityType === 'INTERNSHIP' && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                  <FiAward className="w-4 h-4" /> Completion
                </h2>
              </Card.Header>
              <Card.Body>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    🎉 You have completed this internship!
                  </p>
                  {application.completedAt && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      Completed on {format(new Date(application.completedAt), 'MMM d, yyyy')}
                    </p>
                  )}
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    The completed internship is now visible in your public portfolio.
                  </p>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Internship lifecycle dates card */}
          {application.opportunityType === 'INTERNSHIP' && (application.selectedAt || application.startDate || application.startedAt || application.expectedEndDate || application.completedAt) && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Internship Details
                </h2>
              </Card.Header>
              <Card.Body className="space-y-2">
                {application.selectedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Selected:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {format(new Date(application.selectedAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {application.startDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Start Date:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {format(new Date(application.startDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {application.expectedEndDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Expected End:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {format(new Date(application.expectedEndDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {application.startedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Started:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {format(new Date(application.startedAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {application.completedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Completed:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {format(new Date(application.completedAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Phase 6A: Offer response confirmation */}
          {(application.status === 'OFFER_ACCEPTED' || application.status === 'OFFER_REJECTED') && application.offerRespondedAt && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                  <FiAward className="w-4 h-4" /> Placement Decision
                </h2>
              </Card.Header>
              <Card.Body>
                <div className={`rounded-lg p-3 ${
                  application.status === 'OFFER_ACCEPTED'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
                }`}>
                  <p className={`text-sm font-medium ${
                    application.status === 'OFFER_ACCEPTED'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}>
                    {application.status === 'OFFER_ACCEPTED'
                      ? '✅ You have accepted the placement offer!'
                      : '❌ You have declined the placement offer.'}
                  </p>
                  <p className={`text-xs mt-1 ${
                    application.status === 'OFFER_ACCEPTED'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    Responded on {format(new Date(application.offerRespondedAt), 'MMM d, yyyy')}
                  </p>
                  {application.status === 'OFFER_ACCEPTED' && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      Congratulations! Please coordinate with {getCompanyName(application)} for further details.
                    </p>
                  )}
                </div>
              </Card.Body>
            </Card>
          )}
        </div>

        <Card>
          <Card.Header>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Timeline</h2>
          </Card.Header>
          <Card.Body>
            {application.timeline.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No status changes yet.</p>
            ) : (
              <TimelineList timeline={application.timeline} />
            )}
          </Card.Body>
        </Card>
      </div>

      <ConfirmDialog
        open={showWithdraw}
        title="Withdraw Application"
        description="Are you sure you want to withdraw this application? This action cannot be undone."
        confirmLabel="Withdraw"
        variant="danger"
        loading={withdraw.isPending}
        onConfirm={() =>
          withdraw.mutate(application.id, {
            onSuccess: () => {
              setShowWithdraw(false);
              navigate('/student/applications');
            },
          })
        }
        onCancel={() => setShowWithdraw(false)}
      />

      {/* Phase 6A: Accept offer */}
      <ConfirmDialog
        open={showAcceptOffer}
        title="Accept Offer"
        description={`Are you sure you want to accept the offer for ${getOpportunityTitle(application)}? This will confirm your placement. Please ensure you have reviewed the terms and conditions before accepting.`}
        confirmLabel="Accept Offer"
        variant="primary"
        loading={offerResponse.isPending}
        onConfirm={() =>
          offerResponse.mutate(
            { id: application.id, response: 'ACCEPT' },
            {
              onSuccess: () => {
                setShowAcceptOffer(false);
                void refetch();
              },
            },
          )
        }
        onCancel={() => setShowAcceptOffer(false)}
      />

      {/* Phase 6A: Reject offer */}
      <ConfirmDialog
        open={showRejectOffer}
        title="Decline Offer"
        description={`Are you sure you want to decline the offer for ${getOpportunityTitle(application)}? This action cannot be undone.`}
        confirmLabel="Decline Offer"
        variant="danger"
        loading={offerResponse.isPending}
        onConfirm={() =>
          offerResponse.mutate(
            { id: application.id, response: 'REJECT' },
            {
              onSuccess: () => {
                setShowRejectOffer(false);
                void refetch();
              },
            },
          )
        }
        onCancel={() => setShowRejectOffer(false)}
      />

      {/* Phase 6B: Request withdrawal of accepted offer */}
      <ConfirmDialog
        open={showWithdrawOffer}
        title="Request Withdrawal"
        description={`You have accepted the offer for ${getOpportunityTitle(application)}. Submitting a withdrawal will move this application to a "Withdrawal Requested" state. The company will be notified.`}
        confirmLabel="Submit Withdrawal Request"
        variant="danger"
        loading={withdrawOffer.isPending}
        onConfirm={() =>
          withdrawOffer.mutate(
            { reason: withdrawReason || undefined },
            {
              onSuccess: () => {
                setShowWithdrawOffer(false);
                setWithdrawReason('');
                void refetch();
              },
            },
          )
        }
        onCancel={() => {
          setShowWithdrawOffer(false);
          setWithdrawReason('');
        }}
      >
        <div className="mt-3">
          <label
            htmlFor="withdraw-reason"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Reason (optional)
          </label>
          <textarea
            id="withdraw-reason"
            value={withdrawReason}
            onChange={(e) => setWithdrawReason(e.target.value)}
            rows={3}
            placeholder="Tell the company why you'd like to withdraw…"
            className="w-full text-xs rounded border border-slate-300 dark:border-slate-700 px-2 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
