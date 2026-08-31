/**
 * Phase 15B — Student Opportunity Discovery & Application
 *
 * Provides student-facing endpoints for browsing, searching, and applying to
 * faculty/institution opportunities. The student can only see opportunities
 * where:
 *   - targetRoles contains STUDENT
 *   - status is PUBLISHED
 *   - applicationDeadline has not passed
 *
 * All authorization is derived from the authenticated session. The
 * FacultyOpportunity model and Application model are reused — we don't
 * create a new opportunity model.
 */
import { Types } from 'mongoose';
import type { Paginated } from '@aip/types';
import { AppError } from '../../utils/AppError';
import {
  Application,
  CompanyProfile,
  FacultyOpportunity,
  Institution,
  StudentProfile,
  StudentSkill,
} from '../../models';
import { applyPagination, buildPaginated } from '../../utils/pagination';
import { createNotification } from '../notifications/notifications.service';

export interface StudentOpportunityListFilters {
  q?: string;
  opportunityType?: string;
  hostType?: 'COMPANY' | 'INSTITUTION';
  mode?: string;
  requiredExpertise?: string[];
}

export interface StudentOpportunityView {
  id: string;
  title: string;
  description: string;
  opportunityType: string;
  hostType: 'COMPANY' | 'INSTITUTION';
  host: { id: string; name: string; logoUrl?: string };
  requiredExpertise: string[];
  preferredQualifications: string[];
  durationWeeks?: number;
  location: string;
  mode: string;
  applicationDeadline: string;
  openings: number;
  targetRoles: string[];
  status: string;
  postedBy: string;
  hasApplied: boolean;
  applicationStatus?: string;
  matchScore?: number;
  createdAt: string;
}

async function populateHost(opp: {
  _id: unknown;
  hostType: 'COMPANY' | 'INSTITUTION';
  host: unknown;
}): Promise<{ id: string; name: string; logoUrl?: string }> {
  const id = String(opp.host);
  if (opp.hostType === 'COMPANY') {
    const c = await CompanyProfile.findById(id).select('companyName logoUrl').lean();
    return c
      ? { id, name: c.companyName, ...(c.logoUrl ? { logoUrl: c.logoUrl } : {}) }
      : { id, name: '—' };
  }
  const inst = await Institution.findById(id).select('name').lean();
  return inst ? { id, name: inst.name } : { id, name: '—' };
}

function computeExpertiseMatch(studentTags: string[], required: string[]): number {
  const req = new Set(required.map((s) => s.trim().toLowerCase()).filter(Boolean));
  if (req.size === 0) return 0;
  const own = new Set(studentTags.map((s) => s.trim().toLowerCase()).filter(Boolean));
  let hits = 0;
  for (const r of req) if (own.has(r)) hits += 1;
  return Math.round((hits / req.size) * 100);
}

async function getStudentContext(userId: string) {
  const profile = await StudentProfile.findOne({ user: new Types.ObjectId(userId) });
  if (!profile) throw AppError.notFound('Student profile not found');
  const skills = await StudentSkill.find({ student: profile._id }).lean();
  const skillIds = skills.map((s) => String(s.skill));
  return { profile, skillIds };
}

/**
 * List faculty/institution opportunities visible to a student.
 * Filters: PUBLISHED, targetRoles includes STUDENT, deadline not passed.
 */
export async function listOpportunitiesForStudent(
  userId: string,
  pag: { page?: number; pageSize?: number; sortBy?: string; sortDir?: 'asc' | 'desc' },
  filters: StudentOpportunityListFilters,
): Promise<Paginated<StudentOpportunityView>> {
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const where: Record<string, unknown> = {
    status: 'PUBLISHED',
    targetRoles: 'STUDENT',
    applicationDeadline: { $gte: new Date() },
  };
  if (filters.opportunityType) where.opportunityType = filters.opportunityType;
  if (filters.hostType) where.hostType = filters.hostType;
  if (filters.mode) where.mode = filters.mode;
  if (filters.requiredExpertise && filters.requiredExpertise.length > 0) {
    where.requiredExpertise = { $in: filters.requiredExpertise };
  }
  if (filters.q && filters.q.trim().length > 0) {
    where.$text = { $search: filters.q.trim() };
  }

  const { profile, skillIds } = await getStudentContext(userId);

  // Get already-applied opportunities for this student
  const appliedApps = await Application.find({
    student: profile._id,
    opportunityType: {
      $in: [
        'FACULTY_INTERNSHIP',
        'FDP',
        'CONSULTANCY',
        'COLLABORATIVE_RESEARCH',
        'PROJECT',
        'APPRENTICESHIP',
      ],
    },
  })
    .select('opportunity status')
    .lean();
  const appMap = new Map<string, string>(
    appliedApps.map((a) => [String(a.opportunity), String(a.status)]),
  );

  const [rows, total] = await Promise.all([
    FacultyOpportunity.find(where).sort(sort).skip(skip).limit(limit).lean(),
    FacultyOpportunity.countDocuments(where),
  ]);

  const items: StudentOpportunityView[] = await Promise.all(
    (
      rows as unknown as Array<{
        _id: unknown;
        title: string;
        description: string;
        opportunityType: string;
        hostType: 'COMPANY' | 'INSTITUTION';
        host: unknown;
        requiredExpertise: string[];
        preferredQualifications: string[];
        durationWeeks?: number;
        location: string;
        mode: string;
        applicationDeadline: Date;
        openings: number;
        targetRoles: string[];
        status: string;
        postedBy: unknown;
        createdAt: Date;
      }>
    ).map(async (opp) => {
      const host = await populateHost(opp);
      const appStatus = appMap.get(String(opp._id));
      return {
        id: String(opp._id),
        title: opp.title,
        description: opp.description,
        opportunityType: opp.opportunityType,
        hostType: opp.hostType,
        host,
        requiredExpertise: opp.requiredExpertise ?? [],
        preferredQualifications: opp.preferredQualifications ?? [],
        ...(typeof opp.durationWeeks === 'number' ? { durationWeeks: opp.durationWeeks } : {}),
        location: opp.location,
        mode: opp.mode,
        applicationDeadline: opp.applicationDeadline.toISOString(),
        openings: opp.openings ?? 1,
        targetRoles: opp.targetRoles ?? [],
        status: opp.status,
        postedBy: String(opp.postedBy),
        hasApplied: Boolean(appStatus),
        ...(appStatus ? { applicationStatus: appStatus } : {}),
        matchScore: computeExpertiseMatch(skillIds, opp.requiredExpertise ?? []),
        createdAt: (opp.createdAt as Date).toISOString(),
      };
    }),
  );

  return buildPaginated(items, total, page, pageSize);
}

/**
 * Get a single faculty/institution opportunity for a student.
 * Returns 404 if the opportunity is not visible to students.
 */
export async function getOpportunityForStudent(
  userId: string,
  opportunityId: string,
): Promise<StudentOpportunityView & { description: string; fullDetails: true }> {
  if (!Types.ObjectId.isValid(opportunityId)) {
    throw AppError.badRequest('Invalid opportunity id');
  }

  const opp = await FacultyOpportunity.findById(opportunityId);
  if (!opp) throw AppError.notFound('Faculty opportunity not found');

  // Authorization: must be PUBLISHED, target STUDENT, deadline not passed
  if (opp.status !== 'PUBLISHED') {
    throw AppError.notFound('Opportunity is not available');
  }
  if (!opp.targetRoles?.includes('STUDENT')) {
    throw AppError.forbidden('This opportunity is not open to students');
  }
  if (opp.applicationDeadline < new Date()) {
    throw AppError.badRequest('The application deadline for this opportunity has passed');
  }

  const { profile, skillIds } = await getStudentContext(userId);

  const existingApp = await Application.findOne({
    student: profile._id,
    opportunity: opp._id,
  })
    .select('status')
    .lean();

  const host = await populateHost(opp);

  return {
    id: String(opp._id),
    title: opp.title,
    description: opp.description,
    opportunityType: opp.opportunityType,
    hostType: opp.hostType,
    host,
    requiredExpertise: opp.requiredExpertise ?? [],
    preferredQualifications: opp.preferredQualifications ?? [],
    ...(typeof opp.durationWeeks === 'number' ? { durationWeeks: opp.durationWeeks } : {}),
    location: opp.location,
    mode: opp.mode,
    applicationDeadline: opp.applicationDeadline.toISOString(),
    openings: opp.openings ?? 1,
    targetRoles: opp.targetRoles ?? [],
    status: opp.status,
    postedBy: String(opp.postedBy),
    hasApplied: Boolean(existingApp),
    ...(existingApp ? { applicationStatus: String(existingApp.status) } : {}),
    matchScore: computeExpertiseMatch(skillIds, opp.requiredExpertise ?? []),
    createdAt: (opp as unknown as { createdAt: Date }).createdAt.toISOString(),
    fullDetails: true,
  };
}

/**
 * Apply a student to a faculty/institution opportunity.
 * Uses the same Application model — no new model created.
 */
export async function applyToOpportunity(
  userId: string,
  opportunityId: string,
  input: { coverLetter?: string },
): Promise<{ id: string; status: string; applicationId: string }> {
  if (!Types.ObjectId.isValid(opportunityId)) {
    throw AppError.badRequest('Invalid opportunity id');
  }

  const { profile } = await getStudentContext(userId);

  const opp = await FacultyOpportunity.findById(opportunityId);
  if (!opp) throw AppError.notFound('Faculty opportunity not found');

  // Authorization: must be visible to students
  if (opp.status !== 'PUBLISHED') {
    throw AppError.badRequest('Opportunity is not open for applications');
  }
  if (!opp.targetRoles?.includes('STUDENT')) {
    throw AppError.forbidden('This opportunity is not open to students');
  }
  if (opp.applicationDeadline < new Date()) {
    throw AppError.badRequest('The application deadline for this opportunity has passed');
  }

  // Idempotency: check for existing application
  const existing = await Application.findOne({
    student: profile._id,
    opportunity: opp._id,
  });
  if (existing) {
    throw AppError.conflict('You already applied to this opportunity');
  }

  // Compute match score
  const matchScore = computeExpertiseMatch([], opp.requiredExpertise ?? []);

  let created;
  try {
    created = await Application.create({
      student: profile._id,
      opportunityType: opp.opportunityType,
      opportunity: opp._id,
      coverLetter: input.coverLetter,
      matchScore,
      timeline: [{ status: 'APPLIED', at: new Date() }],
    });
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      throw AppError.conflict('You already applied to this opportunity');
    }
    throw err;
  }

  // Notify the host
  await createNotification(
    String(opp.postedBy),
    'FACULTY_APPLICATION_SUBMITTED',
    'New student application received',
    `${profile.fullName} applied to ${opp.title}.`,
    `/${opp.hostType === 'INSTITUTION' ? 'institution' : 'company'}/faculty-opportunities/${String(opp._id)}`,
  );

  // Notify the student
  await createNotification(
    userId,
    'APPLICATION_STATUS_CHANGED',
    'Application submitted',
    `Your application for ${opp.title} was submitted.`,
    `/student/faculty-opportunities/${String(opp._id)}`,
  );

  return {
    id: String(opp._id),
    status: 'APPLIED',
    applicationId: String(created._id),
  };
}

/**
 * Withdraw a student application. Idempotent.
 */
export async function withdrawApplication(
  userId: string,
  opportunityId: string,
): Promise<{ id: string; status: string }> {
  if (!Types.ObjectId.isValid(opportunityId)) {
    throw AppError.badRequest('Invalid opportunity id');
  }

  const { profile } = await getStudentContext(userId);

  const app = await Application.findOne({
    student: profile._id,
    opportunity: new Types.ObjectId(opportunityId),
  });
  if (!app) throw AppError.notFound('Application not found');

  if (app.status === 'WITHDRAWN') {
    return { id: String(app._id), status: 'WITHDRAWN' };
  }

  // Only allow withdrawal before engagement states
  const engagementStatuses = [
    'SELECTED',
    'OFFER_ACCEPTED',
    'INTERNSHIP_STARTED',
    'ONGOING',
    'COMPLETED',
  ];
  if (engagementStatuses.includes(app.status)) {
    throw AppError.badRequest('Cannot withdraw after selection');
  }

  app.status = 'WITHDRAWN';
  app.timeline.push({
    status: 'WITHDRAWN',
    at: new Date(),
    note: 'Withdrawn by student',
  });
  await app.save();

  // Notify host
  const opp = await FacultyOpportunity.findById(opportunityId)
    .select('title postedBy hostType host')
    .lean();
  if (opp?.postedBy) {
    await createNotification(
      String(opp.postedBy),
      'FACULTY_APPLICATION_WITHDRAWN',
      'Student application withdrawn',
      `${profile.fullName} has withdrawn their application for ${opp.title}.`,
      `/${opp.hostType === 'INSTITUTION' ? 'institution' : 'company'}/faculty-opportunities/${String(opp._id)}`,
    );
  }

  return { id: String(app._id), status: 'WITHDRAWN' };
}

/**
 * List student's own applications to faculty/institution opportunities.
 */
export async function listMyApplications(
  userId: string,
  pag: { page?: number; pageSize?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { page, pageSize, skip, limit } = applyPagination(pag);
  const { profile } = await getStudentContext(userId);

  const FACULTY_OPP_TYPES = [
    'FACULTY_INTERNSHIP',
    'FDP',
    'CONSULTANCY',
    'COLLABORATIVE_RESEARCH',
    'PROJECT',
    'APPRENTICESHIP',
  ];

  const where: Record<string, unknown> = {
    student: profile._id,
    opportunityType: { $in: FACULTY_OPP_TYPES },
  };

  const [rows, total] = await Promise.all([
    Application.find(where).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Application.countDocuments(where),
  ]);

  // Enrich with opportunity info
  const oppIds = rows.map((r) => r.opportunity);
  const opps = await FacultyOpportunity.find({ _id: { $in: oppIds } })
    .select('title hostType host opportunityType applicationDeadline')
    .lean();
  const oppMap = new Map(opps.map((o) => [String(o._id), o]));

  // Populate host names
  const hostIds = {
    companies: opps.filter((o) => o.hostType === 'COMPANY').map((o) => o.host),
    institutions: opps.filter((o) => o.hostType === 'INSTITUTION').map((o) => o.host),
  };
  const [companies, institutions] = await Promise.all([
    CompanyProfile.find({ _id: { $in: hostIds.companies } })
      .select('companyName')
      .lean(),
    Institution.find({ _id: { $in: hostIds.institutions } })
      .select('name')
      .lean(),
  ]);
  const companyMap = new Map(companies.map((c) => [String(c._id), c.companyName]));
  const institutionMap = new Map(institutions.map((i) => [String(i._id), i.name]));

  const items = rows.map((r) => {
    const opp = oppMap.get(String(r.opportunity));
    const hostName = opp
      ? opp.hostType === 'COMPANY'
        ? (companyMap.get(String(opp.host)) ?? '—')
        : (institutionMap.get(String(opp.host)) ?? '—')
      : '—';
    return {
      id: String(r._id),
      status: r.status,
      matchScore: r.matchScore,
      coverLetter: r.coverLetter,
      timeline: r.timeline,
      appliedAt: (r as unknown as { createdAt: Date }).createdAt,
      opportunity: opp
        ? {
            id: String(opp._id),
            title: opp.title,
            type: opp.opportunityType,
            hostType: opp.hostType,
            hostName,
            applicationDeadline: opp.applicationDeadline,
          }
        : null,
    };
  });

  return buildPaginated(items, total, page, pageSize);
}
