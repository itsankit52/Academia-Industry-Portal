/**
 * Phase 10 — Outcome Intelligence & Placement Readiness
 *
 * Shared types for the placement readiness engine, outcome analytics,
 * intervention detection, and skill-outcome intelligence. Every shape is
 * deterministic — no LLM, no external services.
 */

import type { ApplicationStatus, OpportunityType, Proficiency } from '@aip/config';

/* ─── Readiness Levels ────────────────────────────────────────────────── */

/**
 * Five-band placement readiness scale. Bands were chosen to align with
 * the career-readiness labels already shipped in Phase 9A/B so the UI
 * can present a single consistent verdict.
 */
export type PlacementReadinessLevel =
  'PLACEMENT_READY' | 'NEARLY_READY' | 'DEVELOPING' | 'NEEDS_IMPROVEMENT' | 'NOT_READY';

export const PLACEMENT_READINESS_BANDS: {
  level: PlacementReadinessLevel;
  min: number;
  label: string;
  description: string;
}[] = [
  {
    level: 'PLACEMENT_READY',
    min: 80,
    label: 'Placement Ready',
    description: 'Strong placement profile. Apply with confidence.',
  },
  {
    level: 'NEARLY_READY',
    min: 65,
    label: 'Nearly Ready',
    description: 'A few high-impact improvements would lock in placement readiness.',
  },
  {
    level: 'DEVELOPING',
    min: 50,
    label: 'Developing',
    description: 'Building a credible profile — close the highest-priority gaps.',
  },
  {
    level: 'NEEDS_IMPROVEMENT',
    min: 30,
    label: 'Needs Improvement',
    description: 'Significant work is needed across skills, training, or applications.',
  },
  {
    level: 'NOT_READY',
    min: 0,
    label: 'Not Ready',
    description: 'Build the foundation: skills, assessments, and industry exposure.',
  },
];

/* ─── Component Scores ────────────────────────────────────────────────── */

/**
 * Deterministic component weights. Total = 1. Weights were selected so
 * Skills + Assessments + Industry Alignment are the dominant signals (they
 * are the most predictive in the existing data) while training, internships,
 * career target, application history, and aptitude provide calibration.
 *
 * Phase 15C: Aptitude is now an explicit component. To preserve the existing
 * 7-component architecture without changing the overall weighting, the
 * `applicationHistory` weight is reduced and the `aptitude` weight is added.
 * Sum is still 1.0.
 */
export const PLACEMENT_READINESS_WEIGHTS = {
  skills: 0.3,
  assessments: 0.2,
  industryAlignment: 0.15,
  training: 0.1,
  internshipExperience: 0.1,
  careerTarget: 0.1,
  applicationHistory: 0.03,
  aptitude: 0.02,
} as const;

export interface PlacementComponentScore {
  /** Discriminator + label so the UI can render components generically. */
  key:
    | 'SKILLS'
    | 'ASSESSMENTS'
    | 'INDUSTRY_ALIGNMENT'
    | 'TRAINING'
    | 'INTERNSHIP_EXPERIENCE'
    | 'CAREER_TARGET'
    | 'APPLICATION_HISTORY'
    | 'APTITUDE';
  /** Component label (UI-friendly). */
  label: string;
  /** 0-100 normalized score. */
  score: number;
  /** The weight this component contributes to the overall score. */
  weight: number;
  /** Weighted contribution = score * weight. */
  contribution: number;
  /** Human-readable evidence items supporting the score. */
  evidence: string[];
}

/* ─── Readiness Result ────────────────────────────────────────────────── */

export interface PlacementStrength {
  /** Stable key so the UI can dedupe and reason about the strength. */
  key: string;
  label: string;
  /** Optional supporting value (e.g. skill count, average score). */
  value?: string;
  detail?: string;
}

export interface PlacementBlocker {
  key: string;
  label: string;
  /** Severity classification that helps prioritise remediation. */
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  /** Why this is blocking. */
  reason: string;
}

export interface PlacementNextAction {
  type: 'TRAINING' | 'SKILL' | 'ASSESSMENT' | 'OPPORTUNITY' | 'MENTOR';
  title: string;
  reason: string;
  ctaPath?: string;
  ctaLabel?: string;
}

export interface PlacementReadiness {
  studentUserId: string;
  overallScore: number;
  readinessLevel: PlacementReadinessLevel;
  readinessLabel: string;
  readinessDescription: string;
  componentScores: PlacementComponentScore[];
  /** Strengths the student is currently leveraging. */
  strengths: PlacementStrength[];
  /** Blockers preventing the next level. */
  blockers: PlacementBlocker[];
  /** Ordered list of recommended next actions. */
  recommendedNextActions: PlacementNextAction[];
  /** ISO timestamp the engine generated this snapshot. */
  generatedAt: string;
  /** When the underlying inputs are insufficient, the result still returns
   *  a deterministic payload — this flag indicates that. The UI uses it
   *  to render an "insufficient data" state alongside the breakdown. */
  insufficientData: boolean;
  /** Detail messages describing what is missing when insufficientData=true. */
  insufficientReasons: string[];
}

/* ─── Outcome Aggregation ─────────────────────────────────────────────── */

/**
 * Application outcome categories derived from the existing
 * APPLICATION_STATUSES enum. The mapping is explicit so the UI/tests can
 * reason about it without guessing.
 */
export type OutcomeCategory =
  | 'APPLIED'
  | 'SHORTLISTED'
  | 'INTERVIEW'
  | 'SELECTED'
  | 'OFFER_ACCEPTED'
  | 'OFFER_REJECTED'
  | 'OFFER_EXPIRED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface OutcomeFunnelStep {
  category: OutcomeCategory;
  label: string;
  count: number;
}

export interface PlacementOutcomes {
  studentUserId: string;
  totalApplications: number;
  shortlistedCount: number;
  interviewCount: number;
  selectedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  offerExpiredCount: number;
  withdrawnCount: number;
  /** offerAccepted / totalApplications. */
  successRate: number;
  /** interviewCount / totalApplications. */
  interviewRate: number;
  /** selectedCount / interviewCount (0 when no interviews). */
  selectionRate: number;
  /** Funnel rendered top-down. */
  funnel: OutcomeFunnelStep[];
  /** ISO timestamp. */
  generatedAt: string;
  /** Insufficient-data flag mirrors the readiness contract. */
  insufficientData: boolean;
}

/* ─── Intervention Detection ─────────────────────────────────────────── */

export type InterventionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type InterventionType =
  | 'LOW_READINESS'
  | 'HIGH_PRIORITY_GAP'
  | 'NO_INTERNSHIP'
  | 'LOW_ASSESSMENT'
  | 'NO_TRAINING'
  | 'REPEATED_REJECTION'
  | 'LOW_INTERVIEW_CONVERSION'
  | 'OFFER_EXPIRY_RISK'
  | 'TARGET_ROLE_BELOW_READINESS';

export interface StudentIntervention {
  studentUserId: string;
  studentName: string;
  branch?: string;
  /** Overall readiness score for ranking. */
  readinessScore: number;
  readinessLevel: PlacementReadinessLevel;
  interventionType: InterventionType;
  severity: InterventionSeverity;
  /** Why the intervention was raised. */
  reason: string;
  /** Suggested action for the institution / mentor. */
  recommendedAction: string;
}

export interface InstitutionInterventions {
  institutionId: string;
  totalStudents: number;
  flaggedCount: number;
  interventions: StudentIntervention[];
  /** Counts grouped by severity — convenience for dashboard tiles. */
  bySeverity: Record<InterventionSeverity, number>;
  generatedAt: string;
}

/* ─── Institution Placement Intelligence ──────────────────────────────── */

export interface ReadinessLevelCount {
  level: PlacementReadinessLevel;
  count: number;
  percentage: number;
}

export interface DepartmentReadiness {
  branch: string;
  total: number;
  averageScore: number;
  /** Distribution by readiness level inside the branch. */
  byLevel: Record<PlacementReadinessLevel, number>;
}

export interface InstitutionPlacementReadiness {
  institutionId: string;
  totalStudents: number;
  readinessDistribution: ReadinessLevelCount[];
  placementReadyCount: number;
  nearlyReadyCount: number;
  needsInterventionCount: number;
  averageScore: number;
  /** Aggregated by branch — only branches with ≥ 1 student appear. */
  byBranch: DepartmentReadiness[];
  /** Aggregated outcome funnel for the institution. */
  outcomes: InstitutionOutcomeMetrics;
  generatedAt: string;
  insufficientData: boolean;
}

export interface InstitutionOutcomeMetrics {
  totalApplications: number;
  shortlistedCount: number;
  interviewCount: number;
  selectedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  offerExpiredCount: number;
  successRate: number;
  interviewRate: number;
  selectionRate: number;
  funnel: OutcomeFunnelStep[];
}

/* ─── Skill Outcome Intelligence ──────────────────────────────────────── */

export interface SkillOutcomeMetric {
  skillId: string;
  name: string;
  category?: string;
  /** How many published opportunities require this skill. */
  skillDemandCount: number;
  /** Distinct opportunities requiring this skill (job + internship). */
  opportunityCount: number;
  /** Distinct applicants (StudentSkill matches + application). */
  applicantsWithSkill: number;
  /** Distinct applicants selected (status SELECTED or OFFER_ACCEPTED). */
  selectedWithSkill: number;
  /** selectedWithSkill / applicantsWithSkill (0 when denominator is 0). */
  selectionRate: number;
  /**
   * Composite 0-100 score expressing how strongly this skill is associated
   * with selection outcomes. Higher = stronger association. We never claim
   * causation — UI must render this as a *correlation/association* signal.
   */
  skillOutcomeStrength: number;
  /**
   * Phase 15C: Demand trend over the last 6 months.
   * - "increasing" — demand grew month-over-month in most recent quarter
   * - "stable" — demand is relatively flat
   * - "decreasing" — demand fell in the most recent quarter
   * - null — insufficient historical data to determine trend
   */
  trend?: 'increasing' | 'stable' | 'decreasing' | null;
}

export interface SkillOutcomeAnalytics {
  institutionId: string;
  metrics: SkillOutcomeMetric[];
  /** Sample-size floor — when the underlying dataset is too small, we
   *  return this state instead of fabricating numbers. */
  insufficientData: boolean;
  insufficientReasons: string[];
  minimumSampleSize: number;
  generatedAt: string;
}

/* ─── Status Mapping (documentation, single source of truth) ─────────── */

/**
 * The mapping from Application.status (enum) to the higher-level
 * OutcomeCategory. The engine consumes this and the UI surfaces the
 * mapping in the readout so users understand how a raw status is
 * summarised.
 */
export const OUTCOME_STATUS_MAP: Record<ApplicationStatus, OutcomeCategory | null> = {
  APPLIED: 'APPLIED',
  UNDER_REVIEW: 'APPLIED',
  SHORTLISTED: 'SHORTLISTED',
  INTERVIEW_SCHEDULED: 'INTERVIEW',
  SELECTED: 'SELECTED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  INTERNSHIP_STARTED: 'SELECTED',
  ONGOING: 'SELECTED',
  COMPLETED: 'SELECTED',
  OFFER_ACCEPTED: 'OFFER_ACCEPTED',
  OFFER_REJECTED: 'OFFER_REJECTED',
  WITHDRAWAL_REQUESTED: 'WITHDRAWN',
  OFFER_EXPIRED: 'OFFER_EXPIRED',
};

export const OUTCOME_LABELS: Record<OutcomeCategory, string> = {
  APPLIED: 'Applied',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview',
  SELECTED: 'Selected',
  OFFER_ACCEPTED: 'Offer Accepted',
  OFFER_REJECTED: 'Offer Rejected',
  OFFER_EXPIRED: 'Offer Expired',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export const OUTCOME_FUNNEL_ORDER: OutcomeCategory[] = [
  'APPLIED',
  'SHORTLISTED',
  'INTERVIEW',
  'SELECTED',
  'OFFER_ACCEPTED',
];

/* ─── Internal helpers (re-exported for tests) ────────────────────────── */

export const SEVERITY_RANK: Record<InterventionSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const SEVERITY_ORDER: InterventionSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export const READINESS_LEVEL_ORDER: PlacementReadinessLevel[] = [
  'PLACEMENT_READY',
  'NEARLY_READY',
  'DEVELOPING',
  'NEEDS_IMPROVEMENT',
  'NOT_READY',
];

/** Internal placement type for the strength/evidence builders. */
export interface StudentProficiencyRow {
  skillId: string;
  name: string;
  category?: string;
  proficiency: Proficiency;
  yearsExperience?: number;
}

export type OpportunityLike = {
  type: OpportunityType;
  id: string;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * PHASE 11 — PLACEMENT DRIVE OPERATIONS
 * Types for institutional placement drive orchestration.
 * ═══════════════════════════════════════════════════════════════════════════ */

// ─── Enums (re-imported for convenience) ────────────────────────────────
import type {
  PlacementDriveMode,
  PlacementDriveStatus,
  PlacementParticipantStatus,
  PlacementParticipantOutcome,
  PlacementEligibilityRuleType,
  PlacementActionItemType,
  PlacementActionItemSeverity,
  PlacementActionItemStatus,
  VerificationStatus,
} from '@aip/config';

/* ─── Drive ─────────────────────────────────────────────────────────────── */

export type { PlacementDriveMode, PlacementDriveStatus };

export interface DriveOpportunity {
  opportunityType: OpportunityType;
  opportunityId: string;
  openings: number;
}

export interface EligibilityRules {
  minCgpa?: number;
  allowedBranches?: string[];
  allowedGraduationYears?: number[];
  maxActiveBacklogs?: number;
  gender?: string;
  minReadinessScore?: number;
  blockIfAlreadyPlaced?: boolean;
  maxOffersHeld?: number;
  resumeRequired?: boolean;
  minSkillProficiency?: Array<{ skillId: string; minProficiency: Proficiency }>;
}

export interface DriveTimelineEntry {
  status: string;
  at: string;
  by?: string;
  note?: string;
}

export interface PlacementDrive {
  id: string;
  institution: string;
  title: string;
  description: string;
  mode: PlacementDriveMode;
  location?: string;
  participatingCompanies: string[];
  opportunities: DriveOpportunity[];
  eligibilityRules: EligibilityRules;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  driveStartsAt?: string;
  driveEndsAt?: string;
  status: PlacementDriveStatus;
  maxParticipationsPerStudent: number;
  totalSlots?: number;
  filledSlots?: number;
  coordinators: string[];
  metadata?: {
    timeline?: DriveTimelineEntry[];
    verification?: {
      status: VerificationStatus;
      verifiedBy?: string;
      verifiedAt?: string;
      note?: string;
    };
  };
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

/* ─── Eligibility ───────────────────────────────────────────────────────── */

export interface EligibilityFailure {
  rule: PlacementEligibilityRuleType;
  message: string;
  expected?: string | number;
  actual?: string | number;
}

export interface EligibilityWarning {
  rule: PlacementEligibilityRuleType;
  message: string;
}

export interface EligibilityResult {
  eligible: boolean;
  failures: EligibilityFailure[];
  warnings: EligibilityWarning[];
  evaluatedAt: string;
}

/* ─── Participant ──────────────────────────────────────────────────────── */

export type { PlacementParticipantStatus, PlacementParticipantOutcome };

export interface ParticipantTimelineEntry {
  status: PlacementParticipantStatus;
  at: string;
  by?: string;
  note?: string;
}

export interface PlacementParticipant {
  id: string;
  drive: string;
  student: string;
  studentProfile: string;
  company: string;
  opportunity?: { opportunityType: OpportunityType; opportunityId: string };
  registeredAt: string;
  currentRound?: string;
  lastActivityAt?: string;
  status: PlacementParticipantStatus;
  application?: string;
  interviews: string[];
  timeline: ParticipantTimelineEntry[];
  notes?: string;
  withdrawnAt?: string;
  withdrawalReason?: string;
  createdAt: string;
  updatedAt: string;
}

/* ─── Outcome ────────────────────────────────────────────────────────────── */

export interface OutcomeSalaryPackage {
  amount?: number;
  currency?: string;
  ctcLpa?: number;
}

export interface OutcomeVerification {
  status: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  note?: string;
}

export interface PlacementDriveOutcome {
  id: string;
  drive: string;
  participant: string;
  application?: string;
  student: string;
  company: string;
  outcome: PlacementParticipantOutcome;
  salaryPackage?: OutcomeSalaryPackage;
  joiningDate?: string;
  offerExpiresAt?: string;
  offerLetterRef?: string;
  notes?: string;
  recordedBy?: string;
  recordedAt: string;
  verification: OutcomeVerification;
  createdAt: string;
  updatedAt: string;
}

/* ─── Action Items ──────────────────────────────────────────────────────── */

export type { PlacementActionItemType, PlacementActionItemSeverity, PlacementActionItemStatus };

export interface PlacementActionItem {
  id: string;
  institution: string;
  drive?: string;
  participant?: string;
  student?: string;
  type: PlacementActionItemType;
  severity: PlacementActionItemSeverity;
  title: string;
  reason: string;
  recommendedAction?: string;
  ctaPath?: string;
  ctaLabel?: string;
  status: PlacementActionItemStatus;
  assigneeRole?: string;
  assignee?: string;
  dueAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

/* ─── Reports ───────────────────────────────────────────────────────────── */

export interface DriveFunnelStep {
  status: PlacementParticipantStatus;
  label: string;
  count: number;
}

export interface DriveCompanyBreakdown {
  companyId: string;
  companyName: string;
  totalRegistered: number;
  totalScreening: number;
  totalShortlisted: number;
  totalInterviewed: number;
  totalOffered: number;
  totalAccepted: number;
  totalRejected: number;
  totalWithdrawn: number;
  totalNoShow: number;
  offerRate?: number;
  acceptanceRate?: number;
}

export interface DriveBranchBreakdown {
  branch: string;
  totalRegistered: number;
  totalAccepted: number;
  acceptedRate?: number;
}

export interface DriveSalaryStats {
  minLpa: number;
  maxLpa: number;
  medianLpa?: number;
  currency: string;
  sampleSize: number;
}

export interface DriveReport {
  driveId: string;
  driveTitle: string;
  driveStatus: PlacementDriveStatus;
  institutionId: string;
  totals: {
    registered: number;
    screening: number;
    shortlisted: number;
    interviewed: number;
    offered: number;
    accepted: number;
    rejected: number;
    withdrawn: number;
    noShow: number;
    declined: number;
  };
  funnel: DriveFunnelStep[];
  rates: {
    screeningRate: number;
    shortlistRate: number;
    interviewRate: number;
    offerRate: number;
    acceptanceRate: number;
    declineRate: number;
  };
  byCompany: DriveCompanyBreakdown[];
  byBranch: DriveBranchBreakdown[];
  salaryStats?: DriveSalaryStats;
  derived: {
    placedCount: number;
    verifiedCount: number;
    pendingVerification: number;
  };
  verified: {
    placedCount: number;
    verifiedCount: number;
    pendingVerification: number;
  };
  verificationBreakdown: {
    pending: number;
    verified: number;
    rejected: number;
  };
  insufficientData: boolean;
  insufficientReasons: string[];
  generatedAt: string;
}

export interface InstitutionDrivesReport {
  institutionId: string;
  from?: string;
  to?: string;
  totalDrives: number;
  activeDrives: number;
  completedDrives: number;
  cancelledDrives: number;
  summaryTotals: {
    registered: number;
    accepted: number;
    verified: number;
    offered: number;
    rejected: number;
    withdrawn: number;
  };
  aggregateFunnel: DriveFunnelStep[];
  aggregateRates: {
    offerRate: number;
    acceptanceRate: number;
    verificationRate: number;
  };
  driveSummaries: Array<{
    driveId: string;
    title: string;
    status: PlacementDriveStatus;
    registered: number;
    accepted: number;
    verified: number;
    offerRate: number;
  }>;
  salaryStats?: {
    overallMinLpa: number;
    overallMaxLpa: number;
    overallMedianLpa?: number;
    currency: string;
    drivesWithOffers: number;
  };
  insufficientData: boolean;
  insufficientReasons: string[];
  generatedAt: string;
}

/* ─── Constants ─────────────────────────────────────────────────────────── */

export const DRIVE_STATUS_ORDER: PlacementDriveStatus[] = [
  'DRAFT',
  'PUBLISHED',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'IN_PROGRESS',
  'OFFERS_IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
  'CANCELLED',
  'ARCHIVED',
];

export const PARTICIPANT_FUNNEL_ORDER: PlacementParticipantStatus[] = [
  'REGISTERED',
  'SCREENING',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'OFFER_RECEIVED',
  'ACCEPTED',
];

/** Maps PLACEMENT_PARTICIPANT_OUTCOMES to PlacementParticipantStatus for display */
export const PARTICIPANT_OUTCOME_LABELS: Record<PlacementParticipantOutcome, string> = {
  SELECTED: 'Selected',
  NOT_SELECTED: 'Not Selected',
  OFFERED: 'Offered',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  DECLINED: 'Declined',
  NO_SHOW: 'No Show',
  WITHDRAWN: 'Withdrawn',
};

/** Maps PLACEMENT_ACTION_ITEM_TYPES to human-readable labels */
export const ACTION_ITEM_TYPE_LABELS: Record<PlacementActionItemType, string> = {
  ELIGIBLE_FOR_DRIVE: 'Eligible for Drive',
  MISSING_RESUME: 'Missing Resume',
  LOW_READINESS_FOR_DRIVE: 'Low Readiness for Drive',
  ALREADY_PLACED_CONFLICT: 'Already Placed Conflict',
  REGISTRATION_DEADLINE_APPROACHING: 'Registration Deadline Approaching',
  DOCUMENT_INCOMPLETE: 'Document Incomplete',
  INTERVIEW_SCHEDULED_REMINDER: 'Interview Scheduled Reminder',
  COMPANY_RESPONSE_OVERDUE: 'Company Response Overdue',
  OFFER_PENDING_FOLLOWUP: 'Offer Pending Follow-up',
  OFFER_EXPIRY_RISK: 'Offer Expiry Risk',
  POST_DRIVE_FOLLOWUP: 'Post-Drive Follow-up',
  OUTCOME_VERIFICATION_REJECTED: 'Outcome Verification Rejected',
  DRIVE_REGISTRATION_OPEN: 'Drive Registration Open',
  DRIVE_OUTCOME_PENDING_RECORD: 'Drive Outcome Pending Record',
};

/** Maps PLACEMENT_DRIVE_STATUSES to human-readable labels */
export const DRIVE_STATUS_LABELS: Record<PlacementDriveStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  REGISTRATION_OPEN: 'Registration Open',
  REGISTRATION_CLOSED: 'Registration Closed',
  IN_PROGRESS: 'In Progress',
  OFFERS_IN_PROGRESS: 'Offers in Progress',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
  ARCHIVED: 'Archived',
};

/** Maps PLACEMENT_DRIVE_MODES to human-readable labels */
export const DRIVE_MODE_LABELS: Record<PlacementDriveMode, string> = {
  ONLINE: 'Online',
  ONSITE: 'On-site',
  HYBRID: 'Hybrid',
};

/** Maps PLACEMENT_PARTICIPANT_STATUSES to human-readable labels */
export const PARTICIPANT_STATUS_LABELS: Record<PlacementParticipantStatus, string> = {
  REGISTERED: 'Registered',
  ELIGIBILITY_FAILED: 'Eligibility Failed',
  SCREENING: 'Screening',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEWED: 'Interviewed',
  OFFER_PENDING: 'Offer Pending',
  OFFER_RECEIVED: 'Offer Received',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  NOT_SELECTED: 'Not Selected',
  DECLINED: 'Declined',
  NO_SHOW: 'No Show',
  WITHDRAWN: 'Withdrawn',
};

export const MIN_DRIVE_SAMPLE = 5;
export const DRIVE_RESPONSE_SLA_HOURS = 72;
