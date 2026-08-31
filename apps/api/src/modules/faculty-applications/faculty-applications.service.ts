/**
 * Phase 13 — Faculty-industry collaboration
 *
 * Adds the faculty-side lifecycle and cross-role visibility that the existing
 * `applications` module could not express without contorting the student
 * pipeline. The Application model itself is shared (and was extended in
 * earlier phases with a `faculty` slot + unique index) — this module owns
 * the operations that are *only* meaningful for faculty applicants:
 *
 *   - Withdraw a submitted application (the existing
 *     `requestOfferWithdrawal` / `respondToOffer` paths are student-only).
 *   - List "My Engagements" — accepted, in-progress and completed
 *     collaborations (SELECTED/ONGOING/COMPLETED, plus the offer-accepted
 *     transition).
 *   - List applicants for a *faculty* opportunity owned by a company or
 *     institution. The existing `listApplications` filter for COMPANY
 *     already covers faculty opportunities posted by that company, but the
 *     institution-side flow is not handled there.
 *   - Compute deterministic match scores for faculty-opportunity pairs.
 *
 * All authorization is derived from the authenticated session — the API
 * never accepts a userId / facultyId / institutionId from the client when
 * the same value is recoverable from `req.user`.
 */

import type { ApplicationStatus, Role } from '@aip/config';
import type { Paginated } from '@aip/types';
import {
  Application,
  CompanyProfile,
  FacultyOpportunity,
  FacultyProfile,
  Institution,
  User,
} from '../../models';
import { AppError } from '../../utils/AppError';
import { createNotification } from '../notifications/notifications.service';
import { computeFacultyMatch, type FacultyMatchResult } from '../matching/facultyMatch';
import { applyPagination, buildPaginated, type PaginationInput } from '../../utils/pagination';

const FACULTY_OPP_TYPES = new Set<string>([
  'FACULTY_INTERNSHIP',
  'FDP',
  'CONSULTANCY',
  'COLLABORATIVE_RESEARCH',
  'PROJECT',
  'APPRENTICESHIP',
]);

// Engagement states = anything past the application gate. SELECTED means
// accepted, ONGOING means the engagement is active, COMPLETED means
// finished, OFFER_ACCEPTED is the JOB/INTERNSHIP-style transition (rare
// for faculty, but the model already supports it).
const ENGAGEMENT_STATUSES: ApplicationStatus[] = [
  'SELECTED',
  'OFFER_ACCEPTED',
  'INTERNSHIP_STARTED',
  'ONGOING',
  'COMPLETED',
];

// Terminal "engagement finished" states. Cancelled engagements also count
// as finished-from-the-faculty-side; a withdrawn application is filtered
// out entirely by the engagement listing because it never became an
// engagement.
const COMPLETED_STATUSES: ApplicationStatus[] = ['COMPLETED'];

function usesFacultyModel(opportunityType: string): boolean {
  return FACULTY_OPP_TYPES.has(opportunityType);
}

async function getMyFacultyProfile(userId: string) {
  const profile = await FacultyProfile.findOne({ user: userId });
  if (!profile) throw AppError.notFound('Faculty profile not found');
  return profile;
}

export async function withdrawFacultyApplication(
  userId: string,
  role: Role,
  applicationId: string,
  reason?: string,
) {
  if (role !== 'FACULTY') {
    throw AppError.forbidden('Only faculty members can withdraw their application');
  }

  const app = await Application.findById(applicationId).populate({
    path: 'faculty',
    populate: { path: 'user', select: '_id' },
  });
  if (!app) throw AppError.notFound('Application not found');

  const faculty = app.faculty as unknown as { _id: unknown; user: { _id: unknown } } | null;
  if (!faculty) throw AppError.forbidden('This application has no faculty applicant');

  const myProfile = await getMyFacultyProfile(userId);
  if (String(faculty._id) !== String(myProfile._id)) {
    throw AppError.forbidden('Not your application');
  }

  if (app.status === 'WITHDRAWN') {
    return app.toJSON();
  }

  // Engagement-state applications need a different message — withdrawing a
  // SELECTED engagement is a soft-cancel, not a passive withdraw. The
  // application model still goes to WITHDRAWN either way; the only
  // difference is the copy and the notification recipient (the host gets
  // a heads-up that the engagement is being cancelled).
  const isEngagement = ENGAGEMENT_STATUSES.includes(app.status as ApplicationStatus);

  app.status = 'WITHDRAWN';
  app.timeline.push({
    status: 'WITHDRAWN',
    at: new Date(),
    note: reason
      ? isEngagement
        ? `Engagement cancelled: ${reason}`
        : `Withdrawn by faculty: ${reason}`
      : isEngagement
        ? 'Engagement cancelled by faculty'
        : 'Withdrawn by faculty',
  });
  await app.save();

  // Notify the host. Faculty opportunities post via `postedBy`, which is
  // the User that created the opportunity — we surface the same channel the
  // company flow already uses.
  const opp = await FacultyOpportunity.findById(app.opportunity).select(
    'title postedBy hostType host',
  );
  if (opp?.postedBy) {
    await createNotification(
      String(opp.postedBy),
      'FACULTY_APPLICATION_WITHDRAWN',
      isEngagement ? 'Faculty engagement cancelled' : 'Faculty application withdrawn',
      `${myProfile.fullName} has ${isEngagement ? 'cancelled their engagement' : 'withdrawn their application'} for ${opp.title}.`,
      `/${opp.hostType === 'INSTITUTION' ? 'institution' : 'company'}/faculty-opportunities/${String(opp._id)}`,
    );
  }

  return app.toJSON();
}

export interface FacultyEngagementRow {
  id: string;
  applicationId: string;
  facultyOpportunityId: string;
  facultyOpportunityTitle: string;
  institutionName: string;
  facultyName: string;
  status: ApplicationStatus;
  startDate?: string;
  endDate?: string;
  deliverables?: string[];
  outcome?: string;
  coverLetter?: string;
  matchScore?: number;
  timeline: unknown[];
  selectedAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

async function getHostName(hostType: 'COMPANY' | 'INSTITUTION', hostId: string): Promise<string> {
  if (hostType === 'COMPANY') {
    const company = await CompanyProfile.findById(hostId).select('companyName').lean();
    return company?.companyName ?? '—';
  }
  const inst = await Institution.findById(hostId).select('name').lean();
  return inst?.name ?? '—';
}

export async function listMyEngagements(
  userId: string,
  role: Role,
  pag: PaginationInput,
  filter: { tab?: 'ACTIVE' | 'COMPLETED' | 'ALL' } = {},
): Promise<Paginated<FacultyEngagementRow>> {
  if (role !== 'FACULTY') {
    throw AppError.forbidden('Only faculty members can list their engagements');
  }
  const profile = await getMyFacultyProfile(userId);

  const where: Record<string, unknown> = {
    faculty: profile._id,
    opportunityType: { $in: Array.from(FACULTY_OPP_TYPES) },
  };

  if (filter.tab === 'ACTIVE') {
    where.status = { $in: ['SELECTED', 'OFFER_ACCEPTED', 'INTERNSHIP_STARTED', 'ONGOING'] };
  } else if (filter.tab === 'COMPLETED') {
    where.status = { $in: COMPLETED_STATUSES };
  } else {
    where.status = { $in: ENGAGEMENT_STATUSES };
  }

  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const [rows, total] = await Promise.all([
    Application.find(where).sort(sort).skip(skip).limit(limit),
    Application.countDocuments(where),
  ]);

  const oppIds = rows.map((r) => r.opportunity);
  const opps = await FacultyOpportunity.find({ _id: { $in: oppIds } })
    .select('title opportunityType hostType host')
    .lean();
  const oppMap = new Map(opps.map((o) => [String(o._id), o]));

  const items: FacultyEngagementRow[] = await Promise.all(
    rows.map(async (r) => {
      const opp = oppMap.get(String(r.opportunity));
      const hostName = opp
        ? await getHostName(opp.hostType as 'COMPANY' | 'INSTITUTION', String(opp.host))
        : '—';
      const json = r.toJSON() as Record<string, unknown>;
      return {
        id: String(r._id),
        applicationId: String(r._id),
        facultyOpportunityId: opp ? String(opp._id) : String(r.opportunity),
        facultyOpportunityTitle: opp?.title ?? '—',
        institutionName: hostName,
        facultyName: profile.fullName,
        status: r.status as ApplicationStatus,
        ...(json.startDate ? { startDate: String(json.startDate) } : {}),
        ...(json.expectedEndDate ? { endDate: String(json.expectedEndDate) } : {}),
        ...(typeof json.coverLetter === 'string' ? { coverLetter: json.coverLetter } : {}),
        ...(typeof json.matchScore === 'number' ? { matchScore: json.matchScore } : {}),
        timeline: (json.timeline ?? []) as unknown[],
        ...(json.selectedAt ? { selectedAt: String(json.selectedAt) } : {}),
        ...(json.startedAt ? { startedAt: String(json.startedAt) } : {}),
        ...(json.completedAt ? { completedAt: String(json.completedAt) } : {}),
        createdAt: String(json.createdAt ?? new Date()),
        updatedAt: String((json.updatedAt as Date) ?? new Date()),
      };
    }),
  );

  return buildPaginated(items, total, page, pageSize);
}

export interface FacultyOpportunityApplicantRow {
  id: string;
  applicationId: string;
  facultyProfileId: string;
  facultyName: string;
  facultyEmail: string;
  department?: string;
  designation?: string;
  qualifications: string[];
  researchInterests: string[];
  status: ApplicationStatus;
  coverLetter?: string;
  matchScore?: number;
  timeline: unknown[];
  appliedAt: string;
}

/**
 * Applicants for a single faculty opportunity. Used by the company-side
 * "applicants" tab on a faculty opportunity detail page and by the
 * institution-side analytics view. The opportunity is resolved from the
 * path id, and the caller is authorized against the opportunity's host —
 * we never accept the host id from the client.
 */
export async function listApplicantsForOpportunity(
  userId: string,
  role: Role,
  opportunityId: string,
  pag: PaginationInput,
): Promise<Paginated<FacultyOpportunityApplicantRow>> {
  const opp = await FacultyOpportunity.findById(opportunityId);
  if (!opp) throw AppError.notFound('Faculty opportunity not found');

  if (role === 'COMPANY') {
    const company = await CompanyProfile.findOne({ user: userId }).select('_id');
    if (!company) throw AppError.forbidden('Company profile not found');
    if (opp.hostType !== 'COMPANY' || String(opp.host) !== String(company._id)) {
      throw AppError.forbidden('Not your opportunity');
    }
  } else if (role === 'INSTITUTION') {
    const user = await User.findById(userId).select('institution');
    if (!user?.institution) throw AppError.forbidden('No institution linked to your account');
    if (opp.hostType !== 'INSTITUTION' || String(opp.host) !== String(user.institution)) {
      throw AppError.forbidden('Not your opportunity');
    }
  } else if (role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  if (!usesFacultyModel(opp.opportunityType)) {
    throw AppError.badRequest('Not a faculty opportunity');
  }

  const where: Record<string, unknown> = {
    opportunityType: opp.opportunityType,
    opportunity: opp._id,
    faculty: { $exists: true, $ne: null },
  };

  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const [rows, total] = await Promise.all([
    Application.find(where).sort(sort).skip(skip).limit(limit),
    Application.countDocuments(where),
  ]);

  const facultyIds = rows.map((r) => r.faculty).filter(Boolean);
  const profiles = await FacultyProfile.find({ _id: { $in: facultyIds } })
    .populate('user', 'email')
    .select('fullName department designation researchInterests qualifications user')
    .lean();
  const profileMap = new Map(profiles.map((p) => [String(p._id), p]));

  const items: FacultyOpportunityApplicantRow[] = rows.map((r) => {
    const profile = profileMap.get(String(r.faculty));
    const userRow = profile?.user as unknown as { email?: string } | undefined;
    const json = r.toJSON() as Record<string, unknown>;
    return {
      id: String(r._id),
      applicationId: String(r._id),
      facultyProfileId: profile ? String(profile._id) : String(r.faculty),
      facultyName: profile?.fullName ?? '—',
      facultyEmail: userRow?.email ?? '',
      ...(profile?.department ? { department: profile.department } : {}),
      ...(profile?.designation ? { designation: profile.designation } : {}),
      qualifications: profile?.qualifications ?? [],
      researchInterests: profile?.researchInterests ?? [],
      status: r.status as ApplicationStatus,
      ...(typeof json.coverLetter === 'string' ? { coverLetter: json.coverLetter } : {}),
      ...(typeof json.matchScore === 'number' ? { matchScore: json.matchScore } : {}),
      timeline: (json.timeline ?? []) as unknown[],
      appliedAt: String(json.createdAt ?? new Date()),
    };
  });

  return buildPaginated(items, total, page, pageSize);
}

/**
 * Pre-compute a deterministic match score for a single opportunity. Useful
 * for the "Apply" panel on the faculty-side details page so the candidate
 * can see how their profile aligns before they apply.
 *
 * Falls back to 0 if the faculty profile cannot be loaded (the faculty
 * user has not completed the onboarding flow).
 */
export async function getMatchScoreForOpportunity(
  userId: string,
  role: Role,
  opportunityId: string,
): Promise<FacultyMatchResult & { opportunityId: string; facultyProfileId: string | null }> {
  if (role !== 'FACULTY') {
    throw AppError.forbidden('Only faculty can request a match score');
  }
  const profile = await FacultyProfile.findOne({ user: userId }).lean();
  const opp = await FacultyOpportunity.findById(opportunityId).select(
    'requiredExpertise targetRoles opportunityType',
  );
  if (!opp) throw AppError.notFound('Faculty opportunity not found');

  const tags: string[] = profile
    ? [...(profile.researchInterests ?? []), ...(profile.qualifications ?? [])]
    : [];

  const result = computeFacultyMatch({
    facultyTags: tags,
    requiredExpertise: opp.requiredExpertise ?? [],
    targetsFaculty: (opp.targetRoles ?? []).includes('FACULTY'),
  });

  return {
    ...result,
    opportunityId: String(opp._id),
    facultyProfileId: profile ? String(profile._id) : null,
  };
}

export interface CompleteEngagementInput {
  notes?: string;
}

/**
 * Mark a faculty engagement as COMPLETED. Allowed for the host
 * (COMPANY/INSTITUTION that owns the opportunity) or ADMIN. The
 * application must currently be in an engagement state (SELECTED /
 * ONGOING / INTERNSHIP_STARTED / OFFER_ACCEPTED) — pre-engagement
 * applications use the regular PATCH /applications/:id/status path,
 * and post-completion applications are terminal.
 *
 * This reuses the existing application status transition map for the
 * shortlist→selected→ongoing→completed path. The faculty member is
 * notified of the completion; the host notification goes through the
 * standard `Application.updateStatus` channel.
 */
export async function completeFacultyEngagement(
  userId: string,
  role: Role,
  applicationId: string,
  input: CompleteEngagementInput = {},
) {
  const app = await Application.findById(applicationId).populate({
    path: 'faculty',
    populate: { path: 'user', select: '_id' },
  });
  if (!app) throw AppError.notFound('Application not found');
  if (!app.faculty) throw AppError.forbidden('Not a faculty application');

  if (!usesFacultyModel(app.opportunityType as string)) {
    throw AppError.badRequest('Not a faculty opportunity');
  }

  // Authorize the caller against the opportunity host. Admins pass
  // through. The application-to-opportunity resolution mirrors the
  // existing updateStatus service.
  const opp = await FacultyOpportunity.findById(app.opportunity).select(
    'hostType host postedBy title',
  );
  if (!opp) throw AppError.notFound('Opportunity not found');

  if (role === 'COMPANY') {
    const company = await CompanyProfile.findOne({ user: userId }).select('_id');
    if (!company) throw AppError.forbidden('Company profile not found');
    const isHost = opp.hostType === 'COMPANY' && String(opp.host) === String(company._id);
    const isPoster = String(opp.postedBy) === userId;
    if (!isHost && !isPoster) throw AppError.forbidden('Not your application');
  } else if (role === 'INSTITUTION') {
    const user = await User.findById(userId).select('institution');
    if (!user?.institution) throw AppError.forbidden('No institution linked');
    if (opp.hostType !== 'INSTITUTION' || String(opp.host) !== String(user.institution)) {
      throw AppError.forbidden('Not your application');
    }
  } else if (role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  // Engagement gate — only post-SELECTED applications can be completed.
  const validPrior = ['SELECTED', 'OFFER_ACCEPTED', 'INTERNSHIP_STARTED', 'ONGOING'];
  if (!validPrior.includes(app.status as string)) {
    throw AppError.badRequest(
      `Engagement can only be completed from ${validPrior.join('/')}; current is ${app.status}`,
    );
  }

  const facultyProfile = app.faculty as unknown as {
    _id: unknown;
    user: { _id: unknown } | null;
    fullName: string;
  };

  app.status = 'COMPLETED';
  (app as unknown as { completedAt: Date }).completedAt = new Date();
  app.timeline.push({
    status: 'COMPLETED',
    at: new Date(),
    ...(input.notes ? { note: input.notes } : { note: 'Engagement completed' }),
  });
  await app.save();

  if (facultyProfile?.user) {
    await createNotification(
      String(facultyProfile.user._id),
      'FACULTY_ENGAGEMENT_COMPLETED',
      'Engagement completed',
      `Your engagement for ${opp.title} has been marked as completed.`,
      `/faculty/applications/${String(app._id)}`,
    );
  }

  return app.toJSON();
}
