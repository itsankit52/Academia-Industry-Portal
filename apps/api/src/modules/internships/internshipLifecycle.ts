/**
 * Internship Lifecycle Service
 *
 * Handles internship-specific status transitions, date management, and validation.
 * This module is used by the applications service when managing INTERNSHIP-type applications.
 */

import type { ApplicationStatus } from '@aip/config';

/**
 * Valid status transitions for internship applications.
 * Maps each status to the set of statuses it can transition to.
 */
export const INTERNSHIP_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: ['SHORTLISTED', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['SHORTLISTED', 'REJECTED', 'WITHDRAWN'],
  SHORTLISTED: ['INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW_SCHEDULED: ['SELECTED', 'REJECTED', 'WITHDRAWN'],
  SELECTED: ['INTERNSHIP_STARTED', 'REJECTED', 'WITHDRAWN', 'OFFER_ACCEPTED', 'OFFER_REJECTED'],
  OFFER_ACCEPTED: [],
  OFFER_REJECTED: [],
  REJECTED: [],
  WITHDRAWN: [],
  INTERNSHIP_STARTED: ['ONGOING'],
  ONGOING: ['COMPLETED'],
  COMPLETED: [],
  // Phase 6B: Withdrawal is handled by a dedicated student endpoint
  // (requestOfferWithdrawal) so this is empty — the generic updateStatus
  // path cannot create this transition.
  WITHDRAWAL_REQUESTED: [],
};

/**
 * Valid status transitions for job applications.
 * Jobs follow a less strict flow — they don't have INTERNSHIP_STARTED/ONGOING
 * states, and historically allowed skipping intermediate steps (e.g. APPLIED → SELECTED).
 * This preserves backward compatibility for jobs.
 */
export const JOB_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: ['UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED', 'WITHDRAWN'],
  SHORTLISTED: ['INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW_SCHEDULED: ['SELECTED', 'REJECTED', 'WITHDRAWN'],
  SELECTED: ['REJECTED', 'WITHDRAWN', 'OFFER_ACCEPTED', 'OFFER_REJECTED'],
  OFFER_ACCEPTED: [],
  OFFER_REJECTED: [],
  REJECTED: [],
  WITHDRAWN: [],
  INTERNSHIP_STARTED: [],
  ONGOING: [],
  COMPLETED: [],
  // Phase 6B: Withdrawal is handled by a dedicated student endpoint, so
  // the generic updateStatus path cannot create this transition.
  WITHDRAWAL_REQUESTED: [],
};

export interface InternshipDates {
  startDate?: Date | null;
  expectedEndDate?: Date | null;
}

export interface InternshipLifecycleInput {
  currentStatus: ApplicationStatus;
  newStatus: ApplicationStatus;
  opportunityType: string;
  selectedAt?: Date | null;
  startDate?: Date | null;
  expectedEndDate?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface InternshipLifecycleResult {
  valid: boolean;
  error?: string;
  dateUpdates?: Partial<{
    selectedAt: Date;
    startDate: Date;
    expectedEndDate: Date;
    startedAt: Date;
    completedAt: Date;
  }>;
}

/**
 * Validates a status transition and returns date updates if applicable.
 */
export function validateInternshipTransition(input: InternshipLifecycleInput): InternshipLifecycleResult {
  const { currentStatus, newStatus, opportunityType } = input;

  // Same status is always valid (no-op)
  if (currentStatus === newStatus) {
    return { valid: true };
  }

  // Get the appropriate transition map
  const transitions = opportunityType === 'INTERNSHIP' ? INTERNSHIP_TRANSITIONS : JOB_TRANSITIONS;
  const allowed = transitions[currentStatus];

  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      error: `Cannot transition from ${currentStatus} to ${newStatus}`,
    };
  }

  // Compute date updates based on the new status
  const dateUpdates: InternshipLifecycleResult['dateUpdates'] = {};

  if (opportunityType === 'INTERNSHIP') {
    if (newStatus === 'SELECTED' && !input.selectedAt) {
      dateUpdates.selectedAt = new Date();
    }
    if (newStatus === 'INTERNSHIP_STARTED' && !input.startedAt) {
      dateUpdates.startedAt = new Date();
    }
    if (newStatus === 'COMPLETED' && !input.completedAt) {
      dateUpdates.completedAt = new Date();
    }
  }

  return { valid: true, dateUpdates };
}

/**
 * Validates internship date fields.
 */
export function validateInternshipDates(input: InternshipDates): { valid: boolean; error?: string } {
  const { startDate, expectedEndDate } = input;

  if (startDate && expectedEndDate) {
    if (expectedEndDate.getTime() <= startDate.getTime()) {
      return { valid: false, error: 'Expected end date must be after start date' };
    }
  }

  return { valid: true };
}

/**
 * Parses date input (string or Date) and validates it.
 */
export function parseDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * Check if a status is a terminal state (no further transitions allowed).
 *
 * `ONGOING` is NOT terminal — the Phase 5B lifecycle ends with
 * `ONGOING → COMPLETED`, and a status check that flagged `ONGOING` as
 * terminal would block the company-side completion handler.
 */
export function isTerminalStatus(status: ApplicationStatus): boolean {
  return (
    status === 'REJECTED' ||
    status === 'WITHDRAWN' ||
    status === 'COMPLETED' ||
    status === 'OFFER_ACCEPTED' ||
    status === 'OFFER_REJECTED'
  );
}

/**
 * Check if a status is an internship-specific state.
 */
export function isInternshipStatus(status: ApplicationStatus): boolean {
  return status === 'INTERNSHIP_STARTED' || status === 'ONGOING';
}
