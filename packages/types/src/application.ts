import type {
  ApplicationStatus,
  OpportunityType,
  RecruitmentSource,
  VerificationStatus,
} from '@aip/config';

export interface TimelineEntry {
  status: ApplicationStatus;
  at: string;
  note?: string;
}

export interface ApplicantRef {
  id: string;
  fullName: string;
  email: string;
}

export interface Application {
  id: string;
  /**
   * The applicant. Students apply to company postings; faculty-facing
   * opportunities (FDPs, consultancy, collaborative research) put a faculty
   * profile in the applicant slot instead, so exactly one of the two is set.
   * Either arrives as a bare id or, once the API has resolved it, as a ref.
   */
  student?: string | ApplicantRef;
  faculty?: string | ApplicantRef;
  opportunityType: OpportunityType;
  opportunity: string | { id: string; title: string; company?: { id: string; name: string } };
  status: ApplicationStatus;
  resume?: { id: string; url: string; mimeType: string } | null;
  coverLetter?: string;
  matchScore?: number;
  matchedSkills?: string[];
  missingSkills?: string[];
  timeline: TimelineEntry[];
  // Internship lifecycle date fields (set when opportunityType is INTERNSHIP)
  selectedAt?: string;
  startDate?: string;
  expectedEndDate?: string;
  startedAt?: string;
  completedAt?: string;
  // Phase 5B: mentor assignment
  mentor?: string;
  mentorAssignedAt?: string;
  // Phase 6A: offer response
  offerRespondedAt?: string;
  // Phase 6B: offer details
  offerDetails?: {
    offeredSalary?: number;
    currency?: string;
    joiningDate?: string;
    offerTerms?: string;
    updatedAt?: string;
  };
  offerExpiresAt?: string;
  offerLetter?: { id: string; filename: string; mimeType: string };
  // Phase 6B: withdrawal
  withdrawalRequestedAt?: string;
  withdrawalReason?: string;
  // Phase 7B: recruitment source — owned by the application so each candidate
  // is attributed independently. Optional for backward compatibility with
  // pre-Phase 7B records.
  recruitmentSource?: RecruitmentSource;
  recruitmentSourceUpdatedAt?: string;
  // Phase 7B: company-confirmed placement completion (JOB or INTERNSHIP after
  // OFFER_ACCEPTED). Distinct from completedAt which is the generic lifecycle
  // timestamp.
  placedAt?: string;
  placementCompletedBy?: string;
  placementCompletionNotes?: string;
  // Phase 7B: institution/admin verification of the placement.
  placementVerification?: {
    status: VerificationStatus;
    verifiedBy?: string;
    verifiedAt?: string;
    note?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export function getOpportunityTitle(app: Application): string {
  if (typeof app.opportunity === 'object' && app.opportunity !== null) return app.opportunity.title;
  return '—';
}

export function getCompanyName(app: Application): string {
  if (typeof app.opportunity === 'object' && app.opportunity !== null && app.opportunity.company) {
    return app.opportunity.company.name;
  }
  return '—';
}

export function getOpportunityId(app: Application): string {
  if (typeof app.opportunity === 'object' && app.opportunity !== null) return app.opportunity.id;
  if (typeof app.opportunity === 'string') return app.opportunity;
  return '';
}

/**
 * The resolved applicant, whichever slot it arrived in. Both company- and
 * institution-side views show a single "candidate" column, so they read this
 * rather than caring which kind of profile applied.
 */
function getApplicant(app: Application): ApplicantRef | null {
  for (const ref of [app.student, app.faculty]) {
    if (typeof ref === 'object' && ref !== null) return ref;
  }
  return null;
}

export function getStudentName(app: Application): string {
  return getApplicant(app)?.fullName || '—';
}

export function getStudentEmail(app: Application): string {
  return getApplicant(app)?.email || '—';
}

export function getResumeUrl(app: Application): string | undefined {
  if (app.resume !== null && typeof app.resume === 'object') return app.resume.url;
  return undefined;
}
