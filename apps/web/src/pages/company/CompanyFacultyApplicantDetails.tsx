import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiArrowLeft,
  FiMail,
  FiBookOpen,
  FiAward,
  FiCheckCircle,
  FiXCircle,
  FiFlag,
} from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import MatchBadge from '@/components/ui/MatchBadge';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import TimelineList from '@/components/features/TimelineList';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { apiGet, apiPatch } from '@/lib/api';
import { format } from 'date-fns';
import type { TimelineEntry } from '@aip/types';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  APPLIED: { label: 'Applied', variant: 'info' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'warning' },
  SHORTLISTED: { label: 'Shortlisted', variant: 'success' },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', variant: 'success' },
  SELECTED: { label: 'Selected', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'default' },
  INTERNSHIP_STARTED: { label: 'Engagement Started', variant: 'success' },
  ONGOING: { label: 'Ongoing', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  OFFER_ACCEPTED: { label: 'Offer Accepted', variant: 'success' },
  OFFER_REJECTED: { label: 'Offer Declined', variant: 'danger' },
  WITHDRAWAL_REQUESTED: { label: 'Withdrawal Requested', variant: 'warning' },
  OFFER_EXPIRED: { label: 'Offer Expired', variant: 'danger' },
};

interface FacultyApplicationDetails {
  id: string;
  applicationId?: string;
  status: string;
  coverLetter?: string;
  matchScore?: number;
  appliedAt: string;
  // Flat fields from the backend service:
  facultyProfileId?: string;
  facultyName: string;
  facultyEmail: string;
  department?: string;
  designation?: string;
  qualifications?: string[];
  researchInterests: string[];
  // Nested form (legacy fallback for `GET /applications/:id`):
  faculty?: FacultyLite;
  opportunity: {
    id: string;
    title: string;
    opportunityType?: string;
  };
  timeline: TimelineEntry[];
}

interface FacultyLite {
  id: string;
  fullName: string;
  email: string;
  department?: string;
  designation?: string;
  qualifications?: string[];
  researchInterests: string[];
}

interface ApplicantsResponse {
  items: FacultyApplicationDetails[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function CompanyFacultyApplicantDetails() {
  const { oppId, appId } = useParams<{ oppId: string; appId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<FacultyApplicationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action state
  const [showAccept, setShowAccept] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    if (!oppId || !appId) return;
    setIsLoading(true);
    setError(null);
    try {
      // Try fetching from the applicants list endpoint and filtering client-side.
      let found: FacultyApplicationDetails | undefined;
      try {
        const list = await apiGet<ApplicantsResponse>(
          `/faculty-opportunities/${oppId}/applicants?pageSize=100`,
        );
        found = list.items.find((a) => a.id === appId);
      } catch {
        found = undefined;
      }
      // Fallback to direct application endpoint
      if (!found) {
        const direct = await apiGet<FacultyApplicationDetails>(`/applications/${appId}`);
        found = direct;
      }
      // Normalize flat service response into the nested shape the component expects.
      if (found && !found.faculty) {
        found.faculty = {
          id: found.facultyProfileId ?? '',
          fullName: found.facultyName,
          email: found.facultyEmail,
          department: found.department,
          designation: found.designation,
          qualifications: found.qualifications,
          researchInterests: found.researchInterests,
        };
        if (!found.opportunity) {
          found.opportunity = { id: oppId, title: '' };
        }
      }
      setData(found);
    } catch {
      setError('Failed to load applicant details. Please try again.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [oppId, appId]);

  async function runAction(fn: () => Promise<unknown>, closeDialog: () => void) {
    setActionPending(true);
    setActionError(null);
    try {
      await fn();
      closeDialog();
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Action failed. Please try again.';
      setActionError(msg);
    } finally {
      setActionPending(false);
    }
  }

  if (error && !data) {
    return (
      <div className="container-page py-8">
        <ErrorState
          title="Failed to load applicant"
          description={error}
          onRetry={() => {
            void load();
          }}
        />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="container-page py-8 space-y-4">
        <SkeletonCard className="h-32" />
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-48" />
      </div>
    );
  }

  const { faculty, opportunity, timeline, coverLetter, matchScore, status } = data;
  if (!faculty) {
    return (
      <div className="container-page py-8">
        <ErrorState
          title="Failed to load applicant"
          description="Missing faculty details for this application."
          onRetry={() => {
            void load();
          }}
        />
      </div>
    );
  }
  const statusCfg = statusConfig[status] ?? {
    label: status,
    variant: 'default' as BadgeVariant,
  };

  const canSelect = !['SELECTED', 'REJECTED', 'COMPLETED', 'WITHDRAWN'].includes(status);
  const canReject = !['REJECTED', 'COMPLETED', 'WITHDRAWN'].includes(status);
  const canComplete = ['ONGOING', 'INTERNSHIP_STARTED'].includes(status);

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title={faculty.fullName}
        subtitle={`Applied for ${opportunity.title}`}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<FiArrowLeft className="w-4 h-4" />}
              onClick={() => navigate(`/company/faculty-opportunities/${oppId}/applicants`)}
            >
              Back
            </Button>
            <Link
              to={`/company/faculty-opportunities/${oppId}/applicants`}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 no-underline dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Back to Applicants
            </Link>
          </>
        }
      />

      {actionError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <Card.Body>
              <div className="flex items-center gap-4">
                <Avatar name={faculty.fullName} size="lg" />
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-slate-900 dark:text-slate-100">
                    {faculty.fullName}
                  </h2>
                  {faculty.designation && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {faculty.designation}
                    </p>
                  )}
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <FiMail className="w-3.5 h-3.5" /> {faculty.email}
                  </p>
                  {faculty.department && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <FiBookOpen className="w-3.5 h-3.5" /> {faculty.department}
                    </p>
                  )}
                </div>
                <Badge variant={statusCfg.variant} size="md">
                  {statusCfg.label}
                </Badge>
              </div>
            </Card.Body>
          </Card>

          {matchScore !== null && matchScore !== undefined && (
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Match Score</h3>
              </Card.Header>
              <Card.Body>
                <MatchBadge score={matchScore} />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Match score is computed from the faculty's qualifications, research interests, and
                  the opportunity requirements.
                </p>
              </Card.Body>
            </Card>
          )}

          <Card>
            <Card.Header>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FiAward className="w-4 h-4" /> Qualifications
              </h3>
            </Card.Header>
            <Card.Body>
              {faculty.qualifications && faculty.qualifications.length > 0 ? (
                <ul className="space-y-1.5">
                  {faculty.qualifications.map((q, i) => (
                    <li
                      key={i}
                      className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2"
                    >
                      <span className="text-indigo-500 mt-1">•</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No qualifications provided.</p>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FiBookOpen className="w-4 h-4" /> Research Interests
              </h3>
            </Card.Header>
            <Card.Body>
              {faculty.researchInterests.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {faculty.researchInterests.map((tag) => (
                    <Badge key={tag} variant="default" size="md">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No research interests listed.</p>
              )}
            </Card.Body>
          </Card>

          {coverLetter && (
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Cover Letter</h3>
              </Card.Header>
              <Card.Body>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {coverLetter}
                </p>
              </Card.Body>
            </Card>
          )}

          <Card>
            <Card.Header>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Application Timeline
              </h3>
            </Card.Header>
            <Card.Body>
              {timeline && timeline.length > 0 ? (
                <TimelineList timeline={timeline} />
              ) : (
                <p className="text-sm text-slate-400">No timeline events yet.</p>
              )}
            </Card.Body>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <Card.Header>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Actions</h3>
            </Card.Header>
            <Card.Body className="space-y-3">
              {canSelect && (
                <Button
                  className="w-full"
                  variant="primary"
                  size="sm"
                  iconLeft={<FiCheckCircle className="w-4 h-4" />}
                  onClick={() => setShowAccept(true)}
                >
                  Accept
                </Button>
              )}
              {canReject && (
                <Button
                  className="w-full"
                  variant="danger"
                  size="sm"
                  iconLeft={<FiXCircle className="w-4 h-4" />}
                  onClick={() => setShowReject(true)}
                >
                  Reject
                </Button>
              )}
              {canComplete && (
                <Button
                  className="w-full"
                  variant="secondary"
                  size="sm"
                  iconLeft={<FiFlag className="w-4 h-4" />}
                  onClick={() => setShowComplete(true)}
                >
                  Complete Engagement
                </Button>
              )}
              {!canSelect && !canReject && !canComplete && (
                <EmptyState
                  icon={<FiFlag className="w-6 h-6" />}
                  title="No actions available"
                  description="This application is in a terminal state."
                />
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Application Summary
              </h3>
            </Card.Header>
            <Card.Body className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Application ID</span>
                <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                  {data.id}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Status</span>
                <Badge variant={statusCfg.variant} size="sm">
                  {statusCfg.label}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Applied</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {format(new Date(data.appliedAt), 'MMM d, yyyy')}
                </span>
              </div>
              {opportunity.opportunityType && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Type</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {opportunity.opportunityType.replace(/_/g, ' ')}
                  </span>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={showAccept}
        title="Accept Faculty Applicant"
        description={`Accept ${faculty.fullName}'s application for "${opportunity.title}"? They will be notified of the decision.`}
        confirmLabel="Accept"
        variant="primary"
        loading={actionPending}
        onConfirm={() =>
          runAction(
            () => apiPatch(`/applications/${appId}/status`, { status: 'SELECTED' }),
            () => setShowAccept(false),
          )
        }
        onCancel={() => setShowAccept(false)}
      />

      <ConfirmDialog
        open={showReject}
        title="Reject Faculty Applicant"
        description={`Reject ${faculty.fullName}'s application for "${opportunity.title}"? This action cannot be undone.`}
        confirmLabel="Reject"
        variant="danger"
        loading={actionPending}
        onConfirm={() =>
          runAction(
            () => apiPatch(`/applications/${appId}/status`, { status: 'REJECTED' }),
            () => setShowReject(false),
          )
        }
        onCancel={() => setShowReject(false)}
      />

      <ConfirmDialog
        open={showComplete}
        title="Complete Engagement"
        description={`Mark the engagement with ${faculty.fullName} as completed? This will finalize the engagement and close out the application.`}
        confirmLabel="Complete Engagement"
        variant="primary"
        loading={actionPending}
        onConfirm={() =>
          runAction(
            () => apiPatch(`/applications/${appId}/engagement/complete`, {}),
            () => setShowComplete(false),
          )
        }
        onCancel={() => setShowComplete(false)}
      />
    </div>
  );
}
