import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiFileText, FiUser, FiUserPlus, FiCheckCircle, FiClock, FiDollarSign, FiCalendar, FiUploadCloud } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import MatchBadge from '@/components/ui/MatchBadge';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import SkillChip from '@/components/ui/SkillChip';
import ScheduleInterviewModal from '@/components/features/ScheduleInterviewModal';
import {
  useCandidateDetails,
  useUpdateApplicationStatus,
} from '@/hooks/queries/useCompanyApplicants';
import {
  useInterimReports,
  useMentorFeedback,
} from '@/hooks/queries/useInterimReports';
import { useDownloadCertificate } from '@/hooks/queries/useDownloadCertificate';
import {
  useApplicationMentor,
  useAssignMentor,
  useRemoveMentor,
  useAvailableMentors,
  useCompleteInternship,
} from '@/hooks/queries/usePhase5B';
import {
  useSetOfferDetails,
  useAttachOfferLetter,
} from '@/hooks/queries/useOfferDetails';
import { useUploadDocument } from '@/hooks/queries/useDocuments';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { format } from 'date-fns';
import type { ApplicationStatus } from '@aip/config';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<ApplicationStatus, { label: string; variant: BadgeVariant }> = {
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

export default function CompanyApplicantDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useCandidateDetails(id!);
  const updateStatus = useUpdateApplicationStatus();
  const reportsQ = useInterimReports(id ?? '');
  const downloadCert = useDownloadCertificate(id ?? '');
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Phase 5B hooks
  const mentorQ = useApplicationMentor(id ?? '');
  const assignMentor = useAssignMentor(id ?? '');
  const removeMentor = useRemoveMentor(id ?? '');
  const completeInternship = useCompleteInternship(id ?? '');
  const availableMentorsQ = useAvailableMentors();
  const [showAssignMentor, setShowAssignMentor] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState('');

  // Phase 6B: Offer details
  const setOfferDetails = useSetOfferDetails(id ?? '');
  const attachOfferLetter = useAttachOfferLetter(id ?? '');
  const uploadDocument = useUploadDocument();
  const [showOfferDetails, setShowOfferDetails] = useState(false);
  const [offerSalary, setOfferSalary] = useState('');
  const [offerCurrency, setOfferCurrency] = useState('INR');
  const [offerJoiningDate, setOfferJoiningDate] = useState('');
  const [offerTerms, setOfferTerms] = useState('');
  const [offerExpiresAt, setOfferExpiresAt] = useState('');

  if (isError) return <ErrorState onRetry={refetch} />;
  if (isLoading || !data)
    return (
      <div className="container-page py-8 space-y-4">
        <SkeletonCard className="h-32" />
        <SkeletonCard className="h-64" />
      </div>
    );

  const { student, skills, opportunity, application } = data;
  const { matchedSkills, missingSkills } = application;
  const resumeUrl = application.resume?.url;
  const statusCfg = statusConfig[application.status] ?? { label: application.status, variant: 'default' as BadgeVariant };
  const isInternship = opportunity.type === 'INTERNSHIP';
  const isOngoing = application.status === 'ONGOING';
  const isCompleted = application.status === 'COMPLETED';
  const canSelect =
    !isInternship &&
    !['SELECTED', 'REJECTED', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'WITHDRAWN'].includes(
      application.status,
    );
  const canAssignMentor =
    isInternship &&
    ['SELECTED', 'INTERNSHIP_STARTED', 'ONGOING'].includes(application.status);
  const canShowReports =
    isInternship &&
    ['SELECTED', 'INTERNSHIP_STARTED', 'ONGOING', 'COMPLETED'].includes(application.status);
  const canShowCert =
    ['ONGOING', 'COMPLETED'].includes(application.status) &&
    (reportsQ.data?.items.length ?? 0) > 0;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title={student.fullName}
        subtitle={`Applied for ${opportunity.title}`}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<FiArrowLeft className="w-4 h-4" />}
              onClick={() => navigate('/company/applicants')}
            >
              Back
            </Button>
            {canShowReports && (
              <Link
                to={`/company/applications/${application.id}/reports`}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 no-underline dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiFileText className="w-4 h-4" /> Progress Reports
              </Link>
            )}
            {canShowCert && (
              <Button
                size="sm"
                iconLeft={<FiDownload className="w-4 h-4" />}
                loading={downloadCert.isPending}
                onClick={() => downloadCert.mutate()}
              >
                {isCompleted ? 'Certificate' : 'Preview Certificate'}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <Card.Body>
              <div className="flex items-center gap-4">
                <Avatar name={student.fullName} size="lg" />
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-slate-900 dark:text-slate-100">
                    {student.fullName}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{student.email}</p>
                  {student.college && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{student.college}</p>
                  )}
                  {student.branch && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {student.branch} {student.cgpa ? `· CGPA ${student.cgpa}` : ''}
                    </p>
                  )}
                </div>
                <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
              </div>
            </Card.Body>
          </Card>

          {application.matchScore !== null && application.matchScore !== undefined && (
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Match Analysis</h3>
              </Card.Header>

              <Card.Body className="space-y-3">
                <MatchBadge score={application.matchScore} />

                {matchedSkills.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                      Matched Skills
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {matchedSkills.map((s) => (
                        <SkillChip
                          key={s}
                          name={s}
                          className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {missingSkills.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                      Missing Skills
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {missingSkills.map((s) => (
                        <SkillChip
                          key={s}
                          name={s}
                          className="bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          {skills.length > 0 && (
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Skills</h3>
              </Card.Header>
              <Card.Body>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-medium"
                    >
                      {s.name}
                      <span className="text-indigo-400 dark:text-indigo-500">
                        · {s.proficiency}
                      </span>
                    </span>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}

          {student.projects.length > 0 && (
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Projects</h3>
              </Card.Header>
              <Card.Body className="space-y-4">
                {student.projects.map((p, i) => (
                  <div
                    key={i}
                    className="border-b border-slate-100 dark:border-slate-800 last:border-0 pb-4 last:pb-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                        {p.title}
                      </p>
                      {p.link && (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600"
                        >
                          View
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                      {p.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {p.techStack.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}

          {student.experience.length > 0 && (
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Experience</h3>
              </Card.Header>
              <Card.Body className="space-y-3">
                {student.experience.map((e, i) => (
                  <div
                    key={i}
                    className="border-b border-slate-100 dark:border-slate-800 last:border-0 pb-3 last:pb-0"
                  >
                    <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                      {e.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {e.organization} · {format(new Date(e.startDate), 'MMM yyyy')} –{' '}
                      {e.endDate ? format(new Date(e.endDate), 'MMM yyyy') : 'Present'}
                    </p>
                    {e.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {e.description}
                      </p>
                    )}
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}

          {application.coverLetter && (
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Cover Letter</h3>
              </Card.Header>
              <Card.Body>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {application.coverLetter}
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
              <ol className="relative border-l border-slate-200 dark:border-slate-700 space-y-4 ml-3">
                {application.timeline.map((t, i) => {
                  const cfg = statusConfig[t.status];
                  return (
                    <li key={i} className="ml-4">
                      <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900" />
                      <Badge variant={cfg.variant} size="sm">
                        {cfg.label}
                      </Badge>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        {format(new Date(t.at), 'MMM d, yyyy h:mm a')}
                      </p>
                      {t.note && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          {t.note}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </Card.Body>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <Card.Header>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Actions</h3>
            </Card.Header>
            <Card.Body className="space-y-3">
              {application.status !== 'SHORTLISTED' &&
                application.status !== 'SELECTED' &&
                application.status !== 'OFFER_ACCEPTED' &&
                application.status !== 'OFFER_REJECTED' && (
                  <Button
                    className="w-full"
                    variant="secondary"
                    size="sm"
                    loading={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: application.id, status: 'SHORTLISTED' })}
                  >
                    Shortlist
                  </Button>
                )}
              <Button className="w-full" size="sm" onClick={() => setScheduleOpen(true)}>
                Schedule Interview
              </Button>
              {/* Phase 6A: Select Candidate (job applications only) */}
              {canSelect && (
                <Button
                  className="w-full"
                  variant="primary"
                  size="sm"
                  iconLeft={<FiCheckCircle className="w-4 h-4" />}
                  loading={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ id: application.id, status: 'SELECTED' })}
                >
                  Select Candidate
                </Button>
              )}
              {/* Phase 5B: Assign/manage mentor */}
              {canAssignMentor && (
                <>
                  {mentorQ.data ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      size="sm"
                      iconLeft={<FiUser className="w-4 h-4" />}
                      onClick={() => setShowAssignMentor(true)}
                    >
                      Change Mentor
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant="outline"
                      size="sm"
                      iconLeft={<FiUserPlus className="w-4 h-4" />}
                      onClick={() => setShowAssignMentor(true)}
                    >
                      Assign Mentor
                    </Button>
                  )}
                </>
              )}
              {/* Phase 5B: Complete internship */}
              {isOngoing && (
                <Button
                  className="w-full"
                  variant="primary"
                  size="sm"
                  iconLeft={<FiCheckCircle className="w-4 h-4" />}
                  onClick={() => setShowComplete(true)}
                >
                  Mark as Completed
                </Button>
              )}
              {application.status !== 'REJECTED' && (
                <Button
                  className="w-full"
                  variant="danger"
                  size="sm"
                  loading={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ id: application.id, status: 'REJECTED' })}
                >
                  Reject
                </Button>
              )}
              {resumeUrl && (
                <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                  <Button
                    className="w-full"
                    variant="outline"
                    size="sm"
                    iconLeft={<FiDownload className="w-4 h-4" />}
                  >
                    Download Resume
                  </Button>
                </a>
              )}
            </Card.Body>
          </Card>

          {/* Phase 5B: Mentor card */}
          {isInternship && mentorQ.data && (
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Assigned Mentor</h3>
              </Card.Header>
              <Card.Body className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {mentorQ.data.fullName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{mentorQ.data.email}</p>
                  </div>
                </div>
                {mentorQ.data.expertise && mentorQ.data.expertise.length > 0 && (
                  <div className="flex flex-wrap gap-1">
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
              </Card.Body>
            </Card>
          )}

          {/* Phase 6A: Offer response status (company view) */}
          {(application.status === 'OFFER_ACCEPTED' || application.status === 'OFFER_REJECTED') && (
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Offer Response</h3>
              </Card.Header>
              <Card.Body>
                <div className={`rounded-lg p-3 ${
                  application.status === 'OFFER_ACCEPTED'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'
                }`}>
                  <p className={`text-sm font-medium ${
                    application.status === 'OFFER_ACCEPTED'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}>
                    {application.status === 'OFFER_ACCEPTED'
                      ? '✅ Candidate accepted the offer'
                      : '⚠️ Candidate declined the offer'}
                  </p>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Phase 6B: Withdrawal request from student (company view) */}
          {application.status === 'WITHDRAWAL_REQUESTED' && (
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Withdrawal Requested</h3>
              </Card.Header>
              <Card.Body>
                <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    ⚠️ The candidate has requested to withdraw from the accepted offer.
                  </p>
                  {application.withdrawalRequestedAt && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Requested on {format(new Date(application.withdrawalRequestedAt), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Phase 6B: Offer details card (shown when SELECTED) */}
          {application.status === 'SELECTED' && (
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FiDollarSign className="w-4 h-4" />
                  Offer Details
                </h3>
              </Card.Header>
              <Card.Body className="space-y-2">
                {application.offerDetails && (
                  <div className="space-y-1.5 text-sm">
                    {application.offerDetails.offeredSalary !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Package:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {application.offerDetails.currency ?? 'INR'}{' '}
                          {application.offerDetails.offeredSalary.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {application.offerDetails.joiningDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Joining:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {format(new Date(application.offerDetails.joiningDate), 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {application.offerExpiresAt && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <FiClock className="w-3.5 h-3.5" />
                    <span>Response deadline: {format(new Date(application.offerExpiresAt), 'MMM d, yyyy')}</span>
                  </div>
                )}
                {application.offerLetter && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <FiFileText className="w-3.5 h-3.5" />
                    Offer letter attached: {application.offerLetter.filename}
                  </div>
                )}
                <Button
                  className="w-full"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Pre-fill with existing values
                    if (application.offerDetails) {
                      setOfferSalary(
                        application.offerDetails.offeredSalary !== undefined
                          ? String(application.offerDetails.offeredSalary)
                          : '',
                      );
                      setOfferCurrency(application.offerDetails.currency ?? 'INR');
                      setOfferJoiningDate(
                        (application.offerDetails?.joiningDate ?? '').split('T')[0] ?? '',
                      );
                      setOfferTerms(application.offerDetails.offerTerms ?? '');
                    } else {
                      setOfferSalary('');
                      setOfferCurrency('INR');
                      setOfferJoiningDate('');
                      setOfferTerms('');
                    }
                    setOfferExpiresAt(
                      (application.offerExpiresAt ?? '').split('T')[0] ?? '',
                    );
                    setShowOfferDetails(true);
                  }}
                >
                  {application.offerDetails ? 'Update Offer Details' : 'Add Offer Details'}
                </Button>
              </Card.Body>
            </Card>
          )}

          {/* Phase 6B: Offer letter upload (shown when SELECTED) */}
          {application.status === 'SELECTED' && (
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FiFileText className="w-4 h-4" />
                  Offer Letter
                </h3>
              </Card.Header>
              <Card.Body>
                <label className="block">
                  <span className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                    Upload offer letter (PDF, DOC, or image)
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="block w-full text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-950/40 dark:file:text-indigo-300"
                    disabled={uploadDocument.isPending || attachOfferLetter.isPending}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      uploadDocument.mutate(
                        {
                          file,
                          documentType: 'OFFER_LETTER',
                          title: `Offer letter for ${student.fullName}`,
                        },
                        {
                          onSuccess: (doc) => {
                            attachOfferLetter.mutate(
                              { documentId: doc.id },
                              {
                                onSuccess: () => {
                                  // reset the input so the same file can be re-uploaded later
                                  e.target.value = '';
                                },
                              },
                            );
                          },
                          onError: () => {
                            e.target.value = '';
                          },
                        },
                      );
                    }}
                  />
                </label>
                {uploadDocument.isPending && (
                  <p className="text-xs text-slate-500 mt-1">Uploading…</p>
                )}
                {attachOfferLetter.isPending && (
                  <p className="text-xs text-slate-500 mt-1">Attaching…</p>
                )}
              </Card.Body>
            </Card>
          )}

          {resumeUrl && (
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Resume</h3>
              </Card.Header>
              <Card.Body className="p-0">
                {resumeUrl.endsWith('.pdf') ? (
                  <iframe src={resumeUrl} title="Resume" className="w-full h-80 rounded-b-xl" />
                ) : (
                  <div className="px-6 py-4">
                    <a
                      href={resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      Open Resume
                    </a>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </div>
      </div>

      <ScheduleInterviewModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        applicationId={application.id}
      />

      {/* Phase 5B: Assign Mentor Modal */}
      <ConfirmDialog
        open={showAssignMentor}
        title="Assign Mentor"
        description={
          mentorQ.data
            ? `Replace the current mentor (${mentorQ.data.fullName})?`
            : 'Select a mentor to assign to this intern.'
        }
        confirmLabel={mentorQ.data ? 'Replace' : 'Assign'}
        loading={assignMentor.isPending}
        onConfirm={() => {
          if (selectedMentorId) {
            assignMentor.mutate(selectedMentorId, {
              onSuccess: () => {
                setShowAssignMentor(false);
                setSelectedMentorId('');
              },
            });
          }
        }}
        onCancel={() => {
          setShowAssignMentor(false);
          setSelectedMentorId('');
        }}
      >
        {mentorQ.data && (
          <button
            className="mt-2 w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded border border-red-200 dark:border-red-800"
            onClick={() => {
              removeMentor.mutate(undefined, {
                onSuccess: () => setShowAssignMentor(false),
              });
            }}
          >
            Remove Current Mentor
          </button>
        )}
        {availableMentorsQ.data?.items && availableMentorsQ.data.items.length > 0 && (
          <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
            {availableMentorsQ.data.items.map((m) => (
              <button
                key={m.id}
                className={`w-full text-left px-3 py-2 rounded text-xs ${
                  selectedMentorId === m.userId
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-300 dark:border-indigo-700'
                    : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                onClick={() => setSelectedMentorId(m.userId)}
              >
                <span className="font-medium">{m.fullName}</span>
                <span className="ml-2 text-slate-500">{m.expertise.slice(0, 2).join(', ')}</span>
              </button>
            ))}
          </div>
        )}
        {availableMentorsQ.isLoading && <p className="text-xs text-slate-500">Loading mentors...</p>}
      </ConfirmDialog>

      {/* Phase 5B: Complete Internship Dialog */}
      <ConfirmDialog
        open={showComplete}
        title="Complete Internship"
        description={`Mark ${student.fullName}'s internship as completed? This will notify the student and make the completion certificate available.`}
        confirmLabel="Complete Internship"
        loading={completeInternship.isPending}
        onConfirm={() =>
          completeInternship.mutate(
            {},
            {
              onSuccess: () => setShowComplete(false),
            },
          )
        }
        onCancel={() => setShowComplete(false)}
      />

      {/* Phase 6B: Set Offer Details Dialog */}
      <ConfirmDialog
        open={showOfferDetails}
        title="Set Offer Details"
        description="Provide the candidate-specific offer. These details are visible only to this candidate and the company; they are not the public posting."
        confirmLabel="Save Offer Details"
        loading={setOfferDetails.isPending}
        onConfirm={() => {
          const payload: {
            offeredSalary?: number;
            currency?: string;
            joiningDate?: string;
            offerTerms?: string;
            offerExpiresAt?: string;
          } = {};
          if (offerSalary !== '' && !Number.isNaN(Number(offerSalary))) {
            payload.offeredSalary = Number(offerSalary);
          }
          if (offerCurrency) payload.currency = offerCurrency;
          if (offerJoiningDate) {
            // The backend expects a full ISO datetime; we only have a date, so
            // anchor it to start of day UTC.
            payload.joiningDate = new Date(`${offerJoiningDate}T00:00:00Z`).toISOString();
          }
          if (offerTerms) payload.offerTerms = offerTerms;
          if (offerExpiresAt) {
            payload.offerExpiresAt = new Date(`${offerExpiresAt}T00:00:00Z`).toISOString();
          }
          setOfferDetails.mutate(payload, {
            onSuccess: () => {
              setShowOfferDetails(false);
            },
          });
        }}
        onCancel={() => setShowOfferDetails(false)}
      >
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Offered Salary
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={offerSalary}
                onChange={(e) => setOfferSalary(e.target.value)}
                placeholder="e.g. 1200000"
                className="flex-1 input input-sm"
              />
              <input
                type="text"
                value={offerCurrency}
                onChange={(e) => setOfferCurrency(e.target.value)}
                placeholder="INR"
                maxLength={8}
                className="w-20 input input-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Joining Date
            </label>
            <input
              type="date"
              value={offerJoiningDate}
              onChange={(e) => setOfferJoiningDate(e.target.value)}
              className="w-full input input-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Response Deadline (optional)
            </label>
            <input
              type="date"
              value={offerExpiresAt}
              onChange={(e) => setOfferExpiresAt(e.target.value)}
              className="w-full input input-sm"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              The student must accept/decline before this date.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Offer Terms (optional)
            </label>
            <textarea
              value={offerTerms}
              onChange={(e) => setOfferTerms(e.target.value)}
              rows={3}
              placeholder="e.g. Probation period, location, work mode…"
              className="w-full text-xs rounded border border-slate-300 dark:border-slate-700 px-2 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
