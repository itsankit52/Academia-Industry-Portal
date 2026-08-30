/**
 * Phase 10 — Placement Outcome Aggregation
 *
 * Derives placement outcome metrics exclusively from existing application data.
 * No new collection is created; no statuses are invented. The mapping from
 * raw APPLICATION_STATUSES to higher-level OutcomeCategory is explicit and
 * lives in @aip/types so the API, UI, and tests all agree.
 *
 * Institution scoping is inherited from the existing institution-analytics
 * patterns: student IDs are resolved server-side from the institution.
 */

import { Types } from 'mongoose';
import type {
  PlacementOutcomes,
  OutcomeFunnelStep,
  OutcomeCategory,
  InstitutionOutcomeMetrics,
} from '@aip/types';
import { OUTCOME_FUNNEL_ORDER } from '@aip/types';
import { Application, StudentProfile } from '../../models';

/* ─── Constants ─────────────────────────────────────────────────────── */

export const OUTCOME_STATUS_MAP: Record<string, OutcomeCategory | null> = {
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

const OUTCOME_LABELS: Record<OutcomeCategory, string> = {
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

const MIN_SAMPLE_SIZE = 3;

/* ─── Helpers ───────────────────────────────────────────────────────── */

function round(n: number, places = 1): number {
  const m = Math.pow(10, places);
  return Math.round(n * m) / m;
}

function mapStatusToOutcome(status: string): OutcomeCategory | null {
  return OUTCOME_STATUS_MAP[status] ?? null;
}

function countByCategory(
  counts: Record<string, number>,
): Record<OutcomeCategory, number> {
  const out: Partial<Record<OutcomeCategory, number>> = {};
  for (const cat of Object.keys(counts) as OutcomeCategory[]) {
    out[cat] = counts[cat] ?? 0;
  }
  // Fill any missing with 0.
  const all: OutcomeCategory[] = [
    'APPLIED',
    'SHORTLISTED',
    'INTERVIEW',
    'SELECTED',
    'OFFER_ACCEPTED',
    'OFFER_REJECTED',
    'OFFER_EXPIRED',
    'REJECTED',
    'WITHDRAWN',
  ];
  for (const cat of all) {
    if (typeof out[cat] !== 'number') out[cat] = 0;
  }
  return out as Record<OutcomeCategory, number>;
}

function buildFunnel(counts: Record<OutcomeCategory, number>): OutcomeFunnelStep[] {
  return OUTCOME_FUNNEL_ORDER.map((cat: OutcomeCategory) => ({
    category: cat,
    label: OUTCOME_LABELS[cat],
    count: counts[cat] ?? 0,
  }));
}

/* ─── Student-level outcomes ───────────────────────────────────────── */

export interface GetStudentOutcomesOptions {
  studentUserId: string;
}

/**
 * Aggregates application outcomes for a single student. The student id is
 * resolved server-side; the client never sends it. Returns a deterministic
 * set of outcome counts and rates.
 */
export async function getStudentOutcomes(
  input: GetStudentOutcomesOptions,
): Promise<PlacementOutcomes> {
  const studentUserId = new Types.ObjectId(input.studentUserId);
  const profile = await StudentProfile.findOne({ user: studentUserId }).select('_id').lean();
  if (!profile) {
    return {
      studentUserId: input.studentUserId,
      totalApplications: 0,
      shortlistedCount: 0,
      interviewCount: 0,
      selectedCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      offerExpiredCount: 0,
      withdrawnCount: 0,
      successRate: 0,
      interviewRate: 0,
      selectionRate: 0,
      funnel: buildFunnel({} as Record<OutcomeCategory, number>),
      generatedAt: new Date().toISOString(),
      insufficientData: true,
    };
  }

  const apps = await Application.find({ student: profile._id }).select('status').lean();
  if (apps.length === 0) {
    return {
      studentUserId: input.studentUserId,
      totalApplications: 0,
      shortlistedCount: 0,
      interviewCount: 0,
      selectedCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      offerExpiredCount: 0,
      withdrawnCount: 0,
      successRate: 0,
      interviewRate: 0,
      selectionRate: 0,
      funnel: buildFunnel({} as Record<OutcomeCategory, number>),
      generatedAt: new Date().toISOString(),
      insufficientData: true,
    };
  }

  const rawCounts: Record<string, number> = {};
  for (const app of apps) {
    const cat = mapStatusToOutcome(app.status);
    if (cat) rawCounts[cat] = (rawCounts[cat] ?? 0) + 1;
  }
  const counts = countByCategory(rawCounts);

  const totalApplications = apps.length;
  const shortlistedCount = counts.SHORTLISTED;
  const interviewCount = counts.INTERVIEW;
  const selectedCount = counts.SELECTED;
  const acceptedCount = counts.OFFER_ACCEPTED;
  const rejectedCount = counts.REJECTED;
  const offerExpiredCount = counts.OFFER_EXPIRED;
  const withdrawnCount = counts.WITHDRAWN;

  const successRate = totalApplications > 0
    ? round((acceptedCount / totalApplications) * 100)
    : 0;
  const interviewRate = totalApplications > 0
    ? round((interviewCount / totalApplications) * 100)
    : 0;
  const selectionRate = interviewCount > 0
    ? round((selectedCount / interviewCount) * 100)
    : 0;

  const insufficientData = totalApplications < MIN_SAMPLE_SIZE;

  return {
    studentUserId: input.studentUserId,
    totalApplications,
    shortlistedCount,
    interviewCount,
    selectedCount,
    acceptedCount,
    rejectedCount,
    offerExpiredCount,
    withdrawnCount,
    successRate,
    interviewRate,
    selectionRate,
    funnel: buildFunnel(counts),
    generatedAt: new Date().toISOString(),
    insufficientData,
  };
}

/* ─── Institution-level outcomes ─────────────────────────────────────── */

/**
 * Aggregates outcome metrics for all students belonging to an institution.
 * Uses a single aggregation pipeline for efficiency (no N+1).
 */
export async function getInstitutionOutcomes(
  institutionId: Types.ObjectId,
): Promise<InstitutionOutcomeMetrics> {
  const studentIds = (await StudentProfile.distinct('_id', {
    institution: institutionId,
  })) as Types.ObjectId[];

  if (studentIds.length === 0) {
    return {
      totalApplications: 0,
      shortlistedCount: 0,
      interviewCount: 0,
      selectedCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      offerExpiredCount: 0,
      successRate: 0,
      interviewRate: 0,
      selectionRate: 0,
      funnel: buildFunnel({} as Record<OutcomeCategory, number>),
    };
  }

  const rawCounts: Record<string, number> = {};
  const apps = await Application.find({ student: { $in: studentIds } })
    .select('status')
    .lean();
  for (const app of apps) {
    const cat = mapStatusToOutcome(app.status);
    if (cat) rawCounts[cat] = (rawCounts[cat] ?? 0) + 1;
  }
  const counts = countByCategory(rawCounts);

  const totalApplications = apps.length;
  const shortlistedCount = counts.SHORTLISTED;
  const interviewCount = counts.INTERVIEW;
  const selectedCount = counts.SELECTED;
  const acceptedCount = counts.OFFER_ACCEPTED;
  const rejectedCount = counts.REJECTED;
  const offerExpiredCount = counts.OFFER_EXPIRED;

  const successRate = totalApplications > 0
    ? round((acceptedCount / totalApplications) * 100)
    : 0;
  const interviewRate = totalApplications > 0
    ? round((interviewCount / totalApplications) * 100)
    : 0;
  const selectionRate = interviewCount > 0
    ? round((selectedCount / interviewCount) * 100)
    : 0;

  return {
    totalApplications,
    shortlistedCount,
    interviewCount,
    selectedCount,
    acceptedCount,
    rejectedCount,
    offerExpiredCount,
    successRate,
    interviewRate,
    selectionRate,
    funnel: buildFunnel(counts),
  };
}

/* ─── Test-only exports ─────────────────────────────────────────────── */

export const __test = {
  mapStatusToOutcome,
  countByCategory,
  buildFunnel,
  round,
  MIN_SAMPLE_SIZE,
};
