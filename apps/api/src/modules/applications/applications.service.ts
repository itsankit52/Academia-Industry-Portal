import type { CreateApplicationInput, UpdateApplicationStatusInput } from '@aip/validation';
import type { ApplicationStatus, OpportunityType, Role } from '@aip/config';
import type { TimelineEntry } from '@aip/types';
import { AppError } from '../../utils/AppError';
import {
  Application,
  Job,
  Internship,
  FacultyOpportunity,
  FacultyProfile,
  Institution,
  Skill,
  StudentProfile,
  StudentSkill,
  CompanyProfile,
  User,
  InterimReport,
  Resume,
  MentorProfile,
  DocumentModel,
} from '../../models';
import { applyPagination, buildPaginated, type PaginationInput } from '../../utils/pagination';
import { computeMatch } from '../matching/algorithm';
import { createNotification } from '../notifications/notifications.service';
import {
  validateInternshipTransition,
  validateInternshipDates,
  parseDate,
  isInternshipStatus,
} from '../internships/internshipLifecycle';

const STUDENT_OPP_TYPES = new Set<OpportunityType>([
  'JOB',
  'INTERNSHIP',
  'PROJECT',
  'APPRENTICESHIP',
]);
const FACULTY_OPP_TYPES = new Set<OpportunityType>([
  'FACULTY_INTERNSHIP',
  'FDP',
  'CONSULTANCY',
  'COLLABORATIVE_RESEARCH',
]);
const FACULTY_MODEL_TYPES = new Set<OpportunityType>([
  'FACULTY_INTERNSHIP',
  'FDP',
  'CONSULTANCY',
  'COLLABORATIVE_RESEARCH',
  'PROJECT',
  'APPRENTICESHIP',
]);

function usesFacultyModel(type: OpportunityType): boolean {
  return FACULTY_MODEL_TYPES.has(type);
}

function computeExpertiseMatch(applicantTags: string[], requiredExpertise: string[]): number {
  const req = new Set(requiredExpertise.map((s) => s.trim().toLowerCase()).filter(Boolean));
  if (req.size === 0) return 0;
  const own = new Set(applicantTags.map((s) => s.trim().toLowerCase()).filter(Boolean));
  let hits = 0;
  for (const r of req) if (own.has(r)) hits += 1;
  return Math.round((hits / req.size) * 100);
}

async function getMyStudentProfile(userId: string) {
  const profile = await StudentProfile.findOne({ user: userId });
  if (!profile) throw AppError.notFound('Student profile not found');
  return profile;
}

async function getMyCompanyProfile(userId: string) {
  const profile = await CompanyProfile.findOne({ user: userId });
  if (!profile) throw AppError.notFound('Company profile not found');
  return profile;
}

function opportunityModel(type: OpportunityType): typeof Job {
  if (type === 'JOB') return Job;
  if (type === 'INTERNSHIP') return Internship as unknown as typeof Job;
  return FacultyOpportunity as unknown as typeof Job;
}

async function getMyFacultyProfile(userId: string) {
  const profile = await FacultyProfile.findOne({ user: userId });
  if (!profile) throw AppError.notFound('Faculty profile not found');
  return profile;
}

async function notifyHostOfApplication(
  opportunityType: OpportunityType,
  opportunityDoc: { _id: unknown; title: string },
  applicantName: string,
  applicationId: string,
): Promise<void> {
  if (!usesFacultyModel(opportunityType)) {
    const opp = opportunityDoc as unknown as { company?: unknown; title: string };
    const company = await CompanyProfile.findById(opp.company).select('user');
    if (company?.user) {
      await createNotification(
        String(company.user),
        'NEW_MATCHING_JOB',
        'New application received',
        `${applicantName} applied to ${opportunityDoc.title}.`,
        // The company-side route for a single application is `/company/applicants/:id`
        // (CompanyApplicantDetails), keyed by the application id — the same path
        // CandidateCard and the applicants table use. `/company/applications/:id` is
        // not a route (only `/company/applications/:appId/reports` is), so it fell
        // through to the `*` NotFound page.
        `/company/applicants/${applicationId}`,
      );
    }
    return;
  }
  const opp = opportunityDoc as unknown as {
    hostType: 'COMPANY' | 'INSTITUTION';
    host: unknown;
    postedBy: unknown;
    title: string;
  };
  if (opp.postedBy) {
    await createNotification(
      String(opp.postedBy),
      'NEW_MATCHING_JOB',
      'New application received',
      `${applicantName} applied to ${opp.title}.`,
      `/${opp.hostType === 'INSTITUTION' ? 'institution' : 'company'}/faculty-opportunities/${String(opportunityDoc._id)}`,
    );
  }
}

/**
 * A published opportunity can still be closed to new applicants: the deadline
 * may have passed, or every opening may already be filled. Neither was checked
 * before, so students could apply to postings the company considered finished.
 */
async function assertAcceptingApplications(
  opportunity: { _id: unknown; applicationDeadline?: Date | null; openings?: number | null },
  type: OpportunityType,
): Promise<void> {
  const deadline = opportunity.applicationDeadline;
  if (deadline instanceof Date && deadline.getTime() < Date.now()) {
    throw AppError.badRequest('The application deadline for this opportunity has passed');
  }

  const openings = opportunity.openings;
  if (typeof openings === 'number' && openings > 0) {
    // Only SELECTED applications consume an opening — everything else is either
    // still in flight or already rejected/withdrawn.
    const filled = await Application.countDocuments({
      opportunityType: type,
      opportunity: opportunity._id,
      status: 'SELECTED',
    });
    if (filled >= openings) {
      throw AppError.badRequest('All openings for this opportunity have been filled');
    }
  }
}

/**
 * Resolves which resume to attach. An explicit `resumeId` must belong to the
 * applying student — otherwise anyone could attach someone else's file by id.
 * With no id we fall back to the student's most recent upload, which is what
 * the apply dialog's "use current resume on file" option means.
 */
async function resolveResumeId(
  studentProfileId: unknown,
  requestedResumeId: string | undefined,
): Promise<unknown | undefined> {
  if (requestedResumeId) {
    const owned = await Resume.findOne({
      _id: requestedResumeId,
      student: studentProfileId,
    }).select('_id');
    if (!owned) throw AppError.badRequest('Resume not found');
    return owned._id;
  }
  const latest = await Resume.findOne({ student: studentProfileId })
    .sort({ createdAt: -1 })
    .select('_id');
  return latest?._id;
}

export async function createApplication(userId: string, role: Role, input: CreateApplicationInput) {
  const type = input.opportunityType;

  if (role === 'STUDENT' && !STUDENT_OPP_TYPES.has(type)) {
    throw AppError.forbidden('Role cannot apply to this opportunity type');
  }
  if (role === 'FACULTY' && !FACULTY_OPP_TYPES.has(type)) {
    throw AppError.forbidden('Role cannot apply to this opportunity type');
  }
  if (role !== 'STUDENT' && role !== 'FACULTY') {
    throw AppError.forbidden('Role cannot apply to opportunities');
  }

  const OpportunityModel = opportunityModel(type);
  const opportunity = await OpportunityModel.findById(input.opportunityId);
  if (!opportunity) throw AppError.notFound('Opportunity not found');
  if (opportunity.status !== 'PUBLISHED') {
    throw AppError.badRequest('Opportunity is not open for applications');
  }
  await assertAcceptingApplications(
    opportunity as unknown as {
      _id: unknown;
      applicationDeadline?: Date | null;
      openings?: number | null;
    },
    type,
  );

  let applicantName: string;
  let applicantSlot: { student?: unknown; faculty?: unknown };
  let matchScore: number;

  if (usesFacultyModel(type)) {
    const opp = opportunity as unknown as {
      _id: unknown;
      title: string;
      targetRoles: Array<'STUDENT' | 'FACULTY'>;
      requiredExpertise: string[];
    };
    if (!opp.targetRoles.includes(role === 'STUDENT' ? 'STUDENT' : 'FACULTY')) {
      throw AppError.forbidden('Role cannot apply to this opportunity type');
    }
    if (role === 'FACULTY') {
      const faculty = await getMyFacultyProfile(userId);
      applicantSlot = { faculty: faculty._id };
      applicantName = faculty.fullName;
      const tags = [...(faculty.researchInterests ?? []), ...(faculty.qualifications ?? [])];
      matchScore = computeExpertiseMatch(tags, opp.requiredExpertise ?? []);
    } else {
      const student = await getMyStudentProfile(userId);
      applicantSlot = { student: student._id };
      applicantName = student.fullName;
      const tags = [
        ...(student.preferredRoles ?? []),
        ...((student.branch ? [student.branch] : []) as string[]),
      ];
      matchScore = computeExpertiseMatch(tags, opp.requiredExpertise ?? []);
    }
  } else {
    const student = await getMyStudentProfile(userId);
    const opp = opportunity as unknown as {
      _id: unknown;
      title: string;
      requiredSkills?: unknown[];
      preferredSkills?: unknown[];
    };
    const studentSkills = await StudentSkill.find({ student: student._id }).select('skill');
    const studentSkillIds = studentSkills.map((s) => String(s.skill));
    const required = (opp.requiredSkills ?? []).map(String);
    const preferred = (opp.preferredSkills ?? []).map(String);
    matchScore = computeMatch(studentSkillIds, required, preferred).score;
    applicantSlot = { student: student._id };
    applicantName = student.fullName;
  }

  let created;
  try {
    const resumeId = applicantSlot.student
      ? await resolveResumeId(applicantSlot.student, input.resumeId)
      : undefined;
    created = await Application.create({
      ...applicantSlot,
      opportunityType: type,
      opportunity: opportunity._id,
      ...(resumeId ? { resume: resumeId } : {}),
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

  await notifyHostOfApplication(
    type,
    opportunity as unknown as { _id: unknown; title: string },
    applicantName,
    String(created._id),
  );

  const applicantHome = role === 'FACULTY' ? 'faculty' : 'student';
  await createNotification(
    userId,
    'APPLICATION_STATUS_CHANGED',
    'Application submitted',
    `Your application for ${(opportunity as unknown as { title: string }).title} was submitted.`,
    `/${applicantHome}/applications/${String(created._id)}`,
  );
  return created.toJSON();
}

export interface ApplicationListFilters {
  status?: ApplicationStatus;
  opportunityType?: OpportunityType;
}

export async function listApplications(
  userId: string,
  role: Role,
  pag: PaginationInput,
  filters: ApplicationListFilters,
) {
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.opportunityType) where.opportunityType = filters.opportunityType;

  if (role === 'STUDENT') {
    const student = await getMyStudentProfile(userId);
    where.student = student._id;
  } else if (role === 'FACULTY') {
    const faculty = await getMyFacultyProfile(userId);
    where.faculty = faculty._id;
  } else if (role === 'COMPANY') {
    const company = await getMyCompanyProfile(userId);
    const [jobs, internships, facultyOpps] = await Promise.all([
      Job.find({ company: company._id }).select('_id'),
      Internship.find({ company: company._id }).select('_id'),
      FacultyOpportunity.find({ hostType: 'COMPANY', host: company._id }).select(
        '_id opportunityType',
      ),
    ]);
    const jobIds = jobs.map((j) => j._id);
    const internshipIds = internships.map((i) => i._id);
    const facultyOppIds = facultyOpps.map((f) => f._id);
    where.$or = [
      { opportunityType: 'JOB', opportunity: { $in: jobIds } },
      { opportunityType: 'INTERNSHIP', opportunity: { $in: internshipIds } },
      { opportunity: { $in: facultyOppIds } },
    ];
  }

  const [rows, total] = await Promise.all([
    Application.find(where).sort(sort).skip(skip).limit(limit),
    Application.countDocuments(where),
  ]);
  const items = await Promise.all(rows.map((r) => enrichApplication(r.toJSON())));
  return buildPaginated(items, total, page, pageSize);
}

/**
 * The flat applicant shape `@aip/types` declares for `Application.student` /
 * `Application.faculty`, and the one `getStudentName()`/`getStudentEmail()` read.
 */
export interface ApplicantRef {
  id: string;
  fullName: string;
  email: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/**
 * An applicant reference reaches serialization in one of two states, and neither
 * is the one the client reads.
 *
 * `listApplications` does not populate, so `student` serializes to a bare id;
 * `getStudentName()` then has no name to show, which is why every company-side
 * list rendered its candidates as "—". `getApplicationById` does populate, but a
 * profile keeps its email on the nested `user` row, so `getStudentEmail()` misses
 * it there. Flatten both into the declared `{ id, fullName, email }`.
 */
async function resolveApplicantRef(
  ref: unknown,
  kind: 'student' | 'faculty',
): Promise<ApplicantRef | undefined> {
  if (ref === null || ref === undefined) return undefined;

  // The slot holds either the profile itself, populated, or a bare reference to
  // it — an ObjectId from `.lean()`, a hex string once `toJSON` has run. An
  // ObjectId is an object too, and its `id` is the raw 12-byte buffer rather than
  // the hex string, so "is this a record?" cannot tell the two apart; carrying a
  // `fullName` can.
  const populated = asRecord(ref);
  const populatedName = typeof populated?.fullName === 'string' ? populated.fullName : null;
  const profileId =
    populatedName !== null ? String(populated?._id ?? populated?.id ?? '') : String(ref);
  if (!profileId) return undefined;

  // Already populated alongside its user row — no further reads needed.
  const populatedUser = asRecord(populated?.user);
  if (populatedName !== null && typeof populatedUser?.email === 'string') {
    return { id: profileId, fullName: populatedName, email: populatedUser.email };
  }

  const profile =
    kind === 'faculty'
      ? await FacultyProfile.findById(profileId).select('fullName user').lean()
      : await StudentProfile.findById(profileId).select('fullName user').lean();
  if (!profile) return undefined;
  const userRow = await User.findById(profile.user).select('email').lean();
  return {
    id: String(profile._id),
    fullName: String(profile.fullName),
    email: userRow?.email ?? '',
  };
}

async function enrichApplication(app: Record<string, unknown>): Promise<Record<string, unknown>> {
  const [student, faculty] = await Promise.all([
    resolveApplicantRef(app.student, 'student'),
    resolveApplicantRef(app.faculty, 'faculty'),
  ]);
  // An application has exactly one applicant, so only the slot that is filled is
  // rewritten; the other keeps whatever the document held.
  const withApplicant: Record<string, unknown> = {
    ...app,
    ...(student ? { student } : {}),
    ...(faculty ? { faculty } : {}),
  };

  const type = app.opportunityType as OpportunityType;
  const oppId = app.opportunity;
  if (!oppId) return withApplicant;

  if (usesFacultyModel(type)) {
    const opp = await FacultyOpportunity.findById(String(oppId))
      .select('title hostType host')
      .lean();
    if (!opp) return withApplicant;
    let hostRef: { id: string; name: string } | null = null;
    if (opp.hostType === 'COMPANY') {
      const c = await CompanyProfile.findById(opp.host).select('companyName').lean();
      hostRef = c ? { id: String(c._id), name: c.companyName } : null;
    } else {
      const i = await Institution.findById(opp.host).select('name').lean();
      hostRef = i ? { id: String(i._id), name: i.name } : null;
    }
    return {
      ...withApplicant,
      opportunity: {
        id: String(opp._id),
        title: opp.title,
        ...(hostRef ? { company: hostRef } : {}),
      },
    };
  }

  const OppModel = opportunityModel(type);
  const opp = await OppModel.findById(String(oppId))
    .select('title company')
    .populate({ path: 'company', select: 'companyName' })
    .lean();
  if (!opp) return withApplicant;
  const company = opp.company as unknown as { _id: unknown; companyName: string } | null;
  return {
    ...withApplicant,
    opportunity: {
      id: String(opp._id),
      title: opp.title,
      ...(company ? { company: { id: String(company._id), name: company.companyName } } : {}),
    },
  };
}

export interface ApplicationSummary {
  applicationId: string;
  candidateName: string;
  opportunityTitle: string;
  companyName: string;
}

/**
 * The applicant and posting names another module needs when it holds only an
 * application id — the interview list, which `@aip/types` declares as carrying a
 * `candidateName`, `opportunityTitle` and `companyName`. Routed through
 * `enrichApplication` so an interview and the applicants table never disagree
 * about who a candidate is.
 */
export async function summarizeApplication(
  applicationId: string,
): Promise<ApplicationSummary | null> {
  const app = await Application.findById(applicationId)
    .select('student faculty opportunity opportunityType')
    .lean();
  if (!app) return null;

  const enriched = await enrichApplication(app as unknown as Record<string, unknown>);
  const applicant = asRecord(enriched.student) ?? asRecord(enriched.faculty);
  const opportunity = asRecord(enriched.opportunity);
  const company = asRecord(opportunity?.company);

  return {
    applicationId: String(app._id),
    candidateName: typeof applicant?.fullName === 'string' ? applicant.fullName : '',
    opportunityTitle: typeof opportunity?.title === 'string' ? opportunity.title : '',
    companyName: typeof company?.name === 'string' ? company.name : '',
  };
}

export async function getApplicationById(userId: string, role: Role, id: string) {
  const app = await Application.findById(id)
    .populate({ path: 'student', populate: { path: 'user', select: 'email' } })
    .populate({ path: 'faculty', populate: { path: 'user', select: 'email' } })
    .populate('resume')
    .populate({ path: 'offerLetter', select: '_id filename mimeType' });
  if (!app) throw AppError.notFound('Application not found');

  const type = app.opportunityType as OpportunityType;
  const studentRef = app.student as unknown as { _id: unknown } | null;
  const facultyRef = app.faculty as unknown as { _id: unknown } | null;

  if (role === 'STUDENT') {
    const student = await getMyStudentProfile(userId);
    if (!studentRef || String(studentRef._id) !== String(student._id)) {
      throw AppError.forbidden('Not your application');
    }
  } else if (role === 'FACULTY') {
    const faculty = await getMyFacultyProfile(userId);
    if (!facultyRef || String(facultyRef._id) !== String(faculty._id)) {
      throw AppError.forbidden('Not your application');
    }
  } else if (role === 'COMPANY') {
    const company = await getMyCompanyProfile(userId);
    if (usesFacultyModel(type)) {
      const opp = await FacultyOpportunity.findById(app.opportunity).select(
        'hostType host postedBy',
      );
      const isHost = opp?.hostType === 'COMPANY' && String(opp.host) === String(company._id);
      const isPoster = opp && String(opp.postedBy) === userId;
      if (!isHost && !isPoster) throw AppError.forbidden('Not your application');
    } else {
      const OppModel = opportunityModel(type);
      const opp = await OppModel.findById(app.opportunity).select('company');
      if (!opp || String(opp.company) !== String(company._id)) {
        throw AppError.forbidden('Not your application');
      }
    }
  } else if (role === 'INSTITUTION') {
    const user = await User.findById(userId).select('institution');
    if (!user?.institution) throw AppError.forbidden('Not your application');
    if (!usesFacultyModel(type)) throw AppError.forbidden('Not your application');
    const opp = await FacultyOpportunity.findById(app.opportunity).select('hostType host');
    if (!opp || opp.hostType !== 'INSTITUTION' || String(opp.host) !== String(user.institution)) {
      throw AppError.forbidden('Not your application');
    }
  }

  const json = app.toJSON() as Record<string, unknown>;
  return enrichApplication(json);
}

export async function updateStatus(
  userId: string,
  role: Role,
  id: string,
  input: UpdateApplicationStatusInput,
) {
  const app = await Application.findById(id)
    .populate({ path: 'student', populate: { path: 'user', select: '_id' } })
    .populate({ path: 'faculty', populate: { path: 'user', select: '_id' } });
  if (!app) throw AppError.notFound('Application not found');

  const type = app.opportunityType as OpportunityType;

  if (role === 'COMPANY') {
    const company = await getMyCompanyProfile(userId);
    if (usesFacultyModel(type)) {
      const opp = await FacultyOpportunity.findById(app.opportunity).select(
        'hostType host postedBy',
      );
      const isHost = opp?.hostType === 'COMPANY' && String(opp.host) === String(company._id);
      const isPoster = opp && String(opp.postedBy) === userId;
      if (!isHost && !isPoster) throw AppError.forbidden('Not your application');
    } else {
      const OppModel = opportunityModel(type);
      const opp = await OppModel.findById(app.opportunity).select('company');
      if (!opp || String(opp.company) !== String(company._id)) {
        throw AppError.forbidden('Not your application');
      }
    }
  } else if (role === 'INSTITUTION') {
    if (!usesFacultyModel(type)) throw AppError.forbidden('Not your application');
    const user = await User.findById(userId).select('institution');
    const opp = await FacultyOpportunity.findById(app.opportunity).select('hostType host');
    if (
      !user?.institution ||
      !opp ||
      opp.hostType !== 'INSTITUTION' ||
      String(opp.host) !== String(user.institution)
    ) {
      throw AppError.forbidden('Not your application');
    }
  } else if (role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  // Validate the status transition (different rules for INTERNSHIP vs JOB)
  const currentStatus = app.status as ApplicationStatus;

  // Phase 6B — deduplicate: if the application is already in the target status,
  // this is a no-op. Returning early avoids duplicate timeline entries and
  // duplicate notifications.
  if (currentStatus === input.status) {
    return app.toJSON();
  }

  const transition = validateInternshipTransition({
    currentStatus,
    newStatus: input.status,
    opportunityType: type,
    selectedAt: (app as unknown as { selectedAt?: Date }).selectedAt ?? null,
    startDate: (app as unknown as { startDate?: Date }).startDate ?? null,
    expectedEndDate: (app as unknown as { expectedEndDate?: Date }).expectedEndDate ?? null,
    startedAt: (app as unknown as { startedAt?: Date }).startedAt ?? null,
  });

  if (!transition.valid) {
    throw AppError.badRequest(transition.error ?? 'Invalid status transition');
  }

  app.status = input.status;
  app.timeline.push({
    status: input.status,
    at: new Date(),
    ...(input.note ? { note: input.note } : {}),
  });

  // Apply automatic date updates for internship lifecycle
  if (transition.dateUpdates) {
    const updates = transition.dateUpdates;
    if (updates.selectedAt) {
      (app as unknown as { selectedAt: Date }).selectedAt = updates.selectedAt;
    }
    if (updates.startDate) {
      (app as unknown as { startDate: Date }).startDate = updates.startDate;
    }
    if (updates.expectedEndDate) {
      (app as unknown as { expectedEndDate: Date }).expectedEndDate = updates.expectedEndDate;
    }
    if (updates.startedAt) {
      (app as unknown as { startedAt: Date }).startedAt = updates.startedAt;
    }
  }

  await app.save();

  const student = app.student as unknown as { user: { _id: unknown } } | null;
  const faculty = app.faculty as unknown as { user: { _id: unknown } } | null;
  const applicantUserId = student
    ? String(student.user._id)
    : faculty
      ? String(faculty.user._id)
      : null;
  const applicantHome = faculty ? 'faculty' : 'student';

  if (applicantUserId) {
    let title = 'the opportunity';
    if (usesFacultyModel(type)) {
      const opp = await FacultyOpportunity.findById(app.opportunity).select('title');
      title = opp?.title ?? title;
    } else {
      const OppModel = opportunityModel(type);
      const opp = await OppModel.findById(app.opportunity).select('title');
      title = opp?.title ?? title;
    }

    if (input.status === 'SELECTED') {
      await createNotification(
        applicantUserId,
        'APPLICATION_SELECTED',
        'You have been selected',
        `Congratulations! You were selected for ${title}.`,
        `/${applicantHome}/applications/${String(app._id)}`,
      );
    } else if (input.status === 'REJECTED') {
      await createNotification(
        applicantUserId,
        'APPLICATION_REJECTED',
        'Application not selected',
        `Your application for ${title} was not selected this time.`,
        `/${applicantHome}/applications/${String(app._id)}`,
      );
    } else if (input.status === 'SHORTLISTED') {
      await createNotification(
        applicantUserId,
        'APPLICATION_SHORTLISTED',
        'You have been shortlisted',
        `You have been shortlisted for ${title}.`,
        `/${applicantHome}/applications/${String(app._id)}`,
      );
    } else if (input.status === 'INTERNSHIP_STARTED') {
      await createNotification(
        applicantUserId,
        'INTERNSHIP_STARTED',
        'Internship started',
        `Your internship for ${title} has started.`,
        `/${applicantHome}/applications/${String(app._id)}`,
      );
    } else if (input.status === 'ONGOING') {
      await createNotification(
        applicantUserId,
        'APPLICATION_STATUS_CHANGED',
        'Internship ongoing',
        `Your internship for ${title} is now ongoing.`,
        `/${applicantHome}/applications/${String(app._id)}`,
      );
    } else {
      // Generic status change notification for intermediate transitions
      await createNotification(
        applicantUserId,
        'APPLICATION_STATUS_CHANGED',
        'Application status updated',
        `Your application for ${title} is now ${input.status.toLowerCase().replace(/_/g, ' ')}.`,
        `/${applicantHome}/applications/${String(app._id)}`,
      );
    }
  }
  return app.toJSON();
}

export async function countByStatus(
  userId: string,
  role: Role,
): Promise<Record<ApplicationStatus, number>> {
  const match: Record<string, unknown> = {};
  if (role === 'FACULTY') {
    const faculty = await getMyFacultyProfile(userId);
    match.faculty = faculty._id;
  } else {
    const student = await getMyStudentProfile(userId);
    match.student = student._id;
  }
  const rows = await Application.aggregate<{ _id: ApplicationStatus; n: number }>([
    { $match: match },
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  const base: Record<ApplicationStatus, number> = {
    APPLIED: 0,
    UNDER_REVIEW: 0,
    SHORTLISTED: 0,
    INTERVIEW_SCHEDULED: 0,
    SELECTED: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
    INTERNSHIP_STARTED: 0,
    ONGOING: 0,
    COMPLETED: 0,
    OFFER_ACCEPTED: 0,
    OFFER_REJECTED: 0,
    WITHDRAWAL_REQUESTED: 0,
  };
  for (const r of rows) base[r._id] = r.n;
  return base;
}

export interface CandidateSkillView {
  id: string;
  name: string;
  category: string;
  proficiency: string;
  yearsExperience?: number;
}

export interface CandidateDetailsView {
  id: string;
  student: {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    college?: string;
    degree?: string;
    branch?: string;
    cgpa?: number;
    gradYear?: number;
    bio?: string;
    projects: unknown[];
    certifications: unknown[];
    experience: unknown[];
    achievements: unknown[];
    preferredRoles: string[];
    preferredLocations: string[];
  };
  skills: CandidateSkillView[];
  opportunity: {
    id: string;
    title: string;
    type: OpportunityType;
    company: { id: string; name: string };
  };
  application: {
    id: string;
    status: ApplicationStatus;
    coverLetter?: string;
    matchScore?: number;
    matchedSkills: string[];
    missingSkills: string[];
    resume?: { url: string; mimeType: string };
    timeline: unknown[];
    createdAt: Date;
    offerDetails?: {
      offeredSalary?: number;
      currency?: string;
      joiningDate?: string;
      offerTerms?: string;
    };
    offerExpiresAt?: string;
    offerLetter?: { id: string; filename: string; mimeType: string };
    offerRespondedAt?: string;
    withdrawalRequestedAt?: string;
  };
  aiNarrative?: string;
}

export async function getCandidateDetails(
  applicationId: string,
  requester: { userId: string; role: Role },
): Promise<CandidateDetailsView> {
  const app = await Application.findById(applicationId)
    .populate('resume')
    .populate({ path: 'offerLetter', select: '_id filename mimeType' });
  if (!app) throw AppError.notFound('Application not found');

  const opportunityType = app.opportunityType as OpportunityType;
  const OpportunityModel = opportunityModel(opportunityType);
  const opportunity = await OpportunityModel.findById(app.opportunity)
    .populate({ path: 'company', select: 'companyName user' })
    .select('title company requiredSkills preferredSkills');
  if (!opportunity) throw AppError.notFound('Opportunity not found');

  const companyRef = opportunity.company as unknown as {
    _id: unknown;
    companyName: string;
    user: unknown;
  } | null;
  if (!companyRef) throw AppError.notFound('Opportunity company missing');

  if (requester.role === 'COMPANY') {
    const requesterCompany = await getMyCompanyProfile(requester.userId);
    if (String(requesterCompany._id) !== String(companyRef._id)) {
      throw AppError.forbidden('Not your application');
    }
  } else if (requester.role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  const student = await StudentProfile.findById(app.student).lean();
  if (!student) throw AppError.notFound('Student not found');
  const userRow = await User.findById(student.user).select('email').lean();
  const email = userRow?.email ?? '';

  const studentSkillDocs = await StudentSkill.find({ student: student._id })
    .populate('skill')
    .lean();
  const skills: CandidateSkillView[] = studentSkillDocs.map((row) => {
    const skill = row.skill as unknown as { _id: unknown; name: string; category: string } | null;
    return {
      id: skill ? String(skill._id) : String(row.skill),
      name: skill?.name ?? '',
      category: skill?.category ?? '',
      proficiency: String(row.proficiency),
      ...(typeof row.yearsExperience === 'number' ? { yearsExperience: row.yearsExperience } : {}),
    };
  });

  const studentSkillIds = studentSkillDocs.map((r) => {
    const s = r.skill as unknown as { _id: unknown } | null;
    return s ? String(s._id) : String(r.skill);
  });
  const required = (opportunity.requiredSkills ?? []).map((s) => String(s));
  const preferred = (opportunity.preferredSkills ?? []).map((s) => String(s));
  const match = computeMatch(studentSkillIds, required, preferred);

  const allMatchIds = Array.from(new Set([...match.matchedSkills, ...match.missingSkills]));
  const skillNameRows =
    allMatchIds.length > 0
      ? await Skill.find({ _id: { $in: allMatchIds } })
          .select('_id name')
          .lean()
      : [];
  const nameMap = new Map(skillNameRows.map((s) => [String(s._id), String(s.name)]));
  const matchedSkills = match.matchedSkills.map((id) => nameMap.get(id) ?? id);
  const missingSkills = match.missingSkills.map((id) => nameMap.get(id) ?? id);

  const resumeRef = app.resume as unknown as { url?: string; mimeType?: string } | null;
  const resume =
    resumeRef && resumeRef.url && resumeRef.mimeType
      ? { url: resumeRef.url, mimeType: resumeRef.mimeType }
      : undefined;

  return {
    id: String(app._id),
    student: {
      id: String(student._id),
      fullName: student.fullName,
      email,
      ...(student.phone ? { phone: student.phone } : {}),
      ...(student.college ? { college: student.college } : {}),
      ...(student.degree ? { degree: student.degree } : {}),
      ...(student.branch ? { branch: student.branch } : {}),
      ...(typeof student.cgpa === 'number' ? { cgpa: student.cgpa } : {}),
      ...(typeof student.graduationYear === 'number' ? { gradYear: student.graduationYear } : {}),
      ...(student.bio ? { bio: student.bio } : {}),
      projects: student.projects ?? [],
      certifications: student.certifications ?? [],
      experience: student.experience ?? [],
      achievements: student.achievements ?? [],
      preferredRoles: (student.preferredRoles ?? []) as string[],
      preferredLocations: (student.preferredLocations ?? []) as string[],
    },
    skills,
    opportunity: {
      id: String(opportunity._id),
      title: String(opportunity.title),
      type: opportunityType,
      company: { id: String(companyRef._id), name: String(companyRef.companyName) },
    },
    application: {
      id: String(app._id),
      status: app.status as ApplicationStatus,
      ...(app.coverLetter ? { coverLetter: app.coverLetter } : {}),
      ...(typeof app.matchScore === 'number' ? { matchScore: app.matchScore } : {}),
      matchedSkills,
      missingSkills,
      ...(resume ? { resume } : {}),
      timeline: ((app.timeline ?? []) as unknown) as TimelineEntry[],
      createdAt: (app as unknown as { createdAt: Date }).createdAt,
      ...buildOfferDetails(app as unknown as Record<string, unknown>),
      ...buildOfferLetterRef(app as unknown as Record<string, unknown>),
      ...buildOfferResponseRef(app as unknown as Record<string, unknown>),
      ...buildWithdrawalRef(app as unknown as Record<string, unknown>),
    } as CandidateDetailsView['application'],
  };
}

/** Pulls offer details out of the app document (inline subdocument). */
function buildOfferDetails(app: Record<string, unknown>) {
  const od = app['offerDetails'] as Record<string, unknown> | undefined;
  if (!od) return {};
  return {
    offerDetails: {
      ...(od.offeredSalary != null ? { offeredSalary: od.offeredSalary } : {}),
      ...(od.currency ? { currency: String(od.currency) } : {}),
      ...(od.joiningDate ? { joiningDate: String(od.joiningDate) } : {}),
      ...(od.offerTerms ? { offerTerms: String(od.offerTerms) } : {}),
    },
    offerExpiresAt: od.offerExpiresAt ? String(od.offerExpiresAt) : undefined,
  };
}

/** Pulls the offer letter ObjectId out of a populated (or bare) offerLetter ref. */
function buildOfferLetterRef(app: Record<string, unknown>) {
  const ref = app['offerLetter'];
  if (!ref) return {};
  if (typeof ref === 'object' && ref !== null) {
    const r = ref as Record<string, unknown>;
    return {
      offerLetter: {
        id: String(r['_id'] ?? r['id'] ?? ''),
        filename: String(r['filename'] ?? ''),
        mimeType: String(r['mimeType'] ?? ''),
      },
    };
  }
  return { offerLetter: { id: String(ref), filename: '', mimeType: '' } };
}

/** Pulls offerRespondedAt if present. */
function buildOfferResponseRef(app: Record<string, unknown>) {
  const t = app['offerRespondedAt'];
  if (!t) return {};
  return { offerRespondedAt: String(t) };
}

/** Pulls withdrawal fields if present. */
function buildWithdrawalRef(app: Record<string, unknown>) {
  const w = app['withdrawalRequestedAt'];
  if (!w) return {};
  return { withdrawalRequestedAt: String(w) };
}

export interface CertificateData {
  studentName: string;
  opportunityTitle: string;
  hostName: string;
  startDate: Date;
  endDate: Date;
  totalHours: number;
  reportCount: number;
}

export async function prepareCertificateData(
  applicationId: string,
  requester: { userId: string; role: Role },
): Promise<CertificateData> {
  const app = await Application.findById(applicationId);
  if (!app) throw AppError.notFound('Application not found');
  // Certificate can be generated for SELECTED, ONGOING, or COMPLETED internships (Phase 5B)
  const eligibleStatuses = ['SELECTED', 'ONGOING', 'COMPLETED'];
  if (!eligibleStatuses.includes(app.status)) {
    throw AppError.badRequest(
      'Certificate available only for selected or completed internship applications',
    );
  }

  const opportunityType = app.opportunityType as OpportunityType;
  const OpportunityModel = opportunityModel(opportunityType);
  const opportunity = await OpportunityModel.findById(app.opportunity).lean();
  if (!opportunity) throw AppError.notFound('Opportunity not found');

  let hostName = '—';
  if (usesFacultyModel(opportunityType)) {
    const opp = opportunity as unknown as { host: unknown; hostType: 'COMPANY' | 'INSTITUTION' };
    if (opp.hostType === 'COMPANY') {
      const c = await CompanyProfile.findById(opp.host).select('companyName user').lean();
      if (c) hostName = String(c.companyName);
      if (requester.role === 'COMPANY') {
        const requesterCompany = await getMyCompanyProfile(requester.userId);
        if (!c || String(c._id) !== String(requesterCompany._id)) {
          throw AppError.forbidden('Not your application');
        }
      }
    } else {
      const inst = await Institution.findById(opp.host).select('name').lean();
      if (inst) hostName = String(inst.name);
    }
  } else {
    const opp = opportunity as unknown as { company: unknown; title: string };
    const c = await CompanyProfile.findById(opp.company).select('companyName user').lean();
    if (c) hostName = String(c.companyName);
    if (requester.role === 'COMPANY') {
      const requesterCompany = await getMyCompanyProfile(requester.userId);
      if (!c || String(c._id) !== String(requesterCompany._id)) {
        throw AppError.forbidden('Not your application');
      }
    }
  }

  const student = await StudentProfile.findById(app.student).select('fullName user').lean();
  if (!student) throw AppError.notFound('Student not found');

  if (requester.role === 'STUDENT') {
    const requesterStudent = await getMyStudentProfile(requester.userId);
    if (String(requesterStudent._id) !== String(student._id)) {
      throw AppError.forbidden('Not your application');
    }
  } else if (requester.role !== 'COMPANY' && requester.role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  const reports = await InterimReport.find({ application: app._id })
    .select('hoursSpent periodStart periodEnd createdAt')
    .lean();
  if (reports.length === 0) {
    throw AppError.badRequest('At least one interim report is required to issue a certificate');
  }

  let totalHours = 0;
  let earliest: Date | undefined;
  let latest: Date | undefined;
  for (const r of reports) {
    if (typeof r.hoursSpent === 'number') totalHours += r.hoursSpent;
    const startCandidate = r.periodStart ?? (r as unknown as { createdAt: Date }).createdAt;
    const endCandidate = r.periodEnd ?? (r as unknown as { createdAt: Date }).createdAt;
    if (!earliest || (startCandidate && startCandidate < earliest)) earliest = startCandidate;
    if (!latest || (endCandidate && endCandidate > latest)) latest = endCandidate;
  }

  return {
    studentName: String(student.fullName),
    opportunityTitle: String((opportunity as unknown as { title: string }).title),
    hostName,
    startDate: earliest ?? new Date(),
    endDate: latest ?? new Date(),
    totalHours,
    reportCount: reports.length,
  };
}

export interface SetInternshipDatesInput {
  startDate?: string;
  expectedEndDate?: string;
}

/**
 * Sets start and expected end dates for an internship application.
 * Only allowed when the application is in SELECTED or INTERNSHIP_STARTED status.
 */
export async function setInternshipDatesForApplication(
  userId: string,
  role: Role,
  applicationId: string,
  input: SetInternshipDatesInput,
) {
  const app = await Application.findById(applicationId)
    .populate({ path: 'student', populate: { path: 'user', select: '_id' } })
    .populate({ path: 'faculty', populate: { path: 'user', select: '_id' } });
  if (!app) throw AppError.notFound('Application not found');

  if (app.opportunityType !== 'INTERNSHIP') {
    throw AppError.badRequest('This operation is only for internship applications');
  }

  // Ownership check
  if (role === 'COMPANY') {
    const company = await getMyCompanyProfile(userId);
    const OppModel = opportunityModel(app.opportunityType as OpportunityType);
    const opp = await OppModel.findById(app.opportunity).select('company');
    if (!opp || String(opp.company) !== String(company._id)) {
      throw AppError.forbidden('Not your application');
    }
  } else if (role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  if (!['SELECTED', 'INTERNSHIP_STARTED'].includes(app.status)) {
    throw AppError.badRequest('Can only set dates for selected or started applications');
  }

  const startDate = input.startDate ? new Date(input.startDate) : null;
  const expectedEndDate = input.expectedEndDate ? new Date(input.expectedEndDate) : null;

  if (startDate || expectedEndDate) {
    const dateValidation = validateInternshipDates({ startDate, expectedEndDate });
    if (!dateValidation.valid) {
      throw AppError.badRequest(dateValidation.error ?? 'Invalid dates');
    }
  }

  if (startDate) {
    (app as unknown as { startDate: Date }).startDate = startDate;
  }
  if (expectedEndDate) {
    (app as unknown as { expectedEndDate: Date }).expectedEndDate = expectedEndDate;
  }

  await app.save();
  return app.toJSON();
}

/**
 * Transitions an application from SELECTED to INTERNSHIP_STARTED.
 */
export async function startInternshipForApplication(
  userId: string,
  role: Role,
  applicationId: string,
  input?: SetInternshipDatesInput,
) {
  const app = await Application.findById(applicationId)
    .populate({ path: 'student', populate: { path: 'user', select: '_id' } })
    .populate({ path: 'faculty', populate: { path: 'user', select: '_id' } });
  if (!app) throw AppError.notFound('Application not found');

  if (app.opportunityType !== 'INTERNSHIP') {
    throw AppError.badRequest('This operation is only for internship applications');
  }

  // Ownership check
  if (role === 'COMPANY') {
    const company = await getMyCompanyProfile(userId);
    const OppModel = opportunityModel(app.opportunityType as OpportunityType);
    const opp = await OppModel.findById(app.opportunity).select('company');
    if (!opp || String(opp.company) !== String(company._id)) {
      throw AppError.forbidden('Not your application');
    }
  } else if (role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  if (app.status !== 'SELECTED') {
    throw AppError.badRequest('Only selected applications can be started');
  }

  const startDate = input?.startDate ? new Date(input.startDate) : null;
  const expectedEndDate = input?.expectedEndDate ? new Date(input.expectedEndDate) : null;

  if (startDate || expectedEndDate) {
    const dateValidation = validateInternshipDates({ startDate, expectedEndDate });
    if (!dateValidation.valid) {
      throw AppError.badRequest(dateValidation.error ?? 'Invalid dates');
    }
  }

  app.status = 'INTERNSHIP_STARTED';
  app.timeline.push({ status: 'INTERNSHIP_STARTED', at: new Date(), note: 'Internship started' });
  (app as unknown as { startedAt: Date }).startedAt = new Date();
  if (startDate) (app as unknown as { startDate: Date }).startDate = startDate;
  if (expectedEndDate) (app as unknown as { expectedEndDate: Date }).expectedEndDate = expectedEndDate;

  await app.save();

  // Notify student
  const student = app.student as unknown as { user: { _id: unknown } } | null;
  if (student?.user) {
    const OppModel = opportunityModel(app.opportunityType as OpportunityType);
    const opp = await OppModel.findById(app.opportunity).select('title');
    const title = opp?.title ?? 'the internship';
    await createNotification(
      String(student.user._id),
      'INTERNSHIP_STARTED',
      'Internship started',
      `Your internship for ${title} has started.`,
      `/student/applications/${String(app._id)}`,
    );
  }

  return app.toJSON();
}

/**
 * Transitions an application from INTERNSHIP_STARTED to ONGOING.
 */
export async function markInternshipOngoingForApplication(
  userId: string,
  role: Role,
  applicationId: string,
) {
  const app = await Application.findById(applicationId)
    .populate({ path: 'student', populate: { path: 'user', select: '_id' } })
    .populate({ path: 'faculty', populate: { path: 'user', select: '_id' } });
  if (!app) throw AppError.notFound('Application not found');

  if (app.opportunityType !== 'INTERNSHIP') {
    throw AppError.badRequest('This operation is only for internship applications');
  }

  // Ownership check
  if (role === 'COMPANY') {
    const company = await getMyCompanyProfile(userId);
    const OppModel = opportunityModel(app.opportunityType as OpportunityType);
    const opp = await OppModel.findById(app.opportunity).select('company');
    if (!opp || String(opp.company) !== String(company._id)) {
      throw AppError.forbidden('Not your application');
    }
  } else if (role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  if (app.status !== 'INTERNSHIP_STARTED') {
    throw AppError.badRequest('Only started internships can be marked as ongoing');
  }

  app.status = 'ONGOING';
  app.timeline.push({ status: 'ONGOING', at: new Date(), note: 'Internship is now ongoing' });
  await app.save();

  // Notify student
  const student = app.student as unknown as { user: { _id: unknown } } | null;
  if (student?.user) {
    const OppModel = opportunityModel(app.opportunityType as OpportunityType);
    const opp = await OppModel.findById(app.opportunity).select('title');
    const title = opp?.title ?? 'the internship';
    await createNotification(
      String(student.user._id),
      'APPLICATION_STATUS_CHANGED',
      'Internship ongoing',
      `Your internship for ${title} is now marked as ongoing.`,
      `/student/applications/${String(app._id)}`,
    );
  }

  return app.toJSON();
}

/* ============================================================
   Phase 6A — Student offer response (placement applications)
   ============================================================ */

export type StudentOfferResponse = 'ACCEPT' | 'REJECT';

function nextStatusFromResponse(response: StudentOfferResponse): ApplicationStatus {
  return response === 'ACCEPT' ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED';
}

/**
 * Phase 6B — offer expiry helper.
 *
 * The architecture does not run a cron to mark expired offers, so this is
 * computed at read/respond time. `offerExpiresAt` is the company's chosen
 * deadline; once `Date.now() > offerExpiresAt`, the offer is treated as
 * expired everywhere it is read.
 */
export function isOfferExpired(application: {
  status: ApplicationStatus;
  offerExpiresAt?: Date | null;
}): boolean {
  // The only status that still cares about expiry is SELECTED — once the
  // student has accepted/rejected or the company has withdrawn the offer,
  // the deadline is moot. Also: a missing deadline means "no deadline".
  if (application.status !== 'SELECTED') return false;
  const deadline = application.offerExpiresAt;
  if (!deadline) return false;
  return deadline.getTime() < Date.now();
}

/**
 * Lets the applicant student accept or reject a SELECTED placement offer.
 * The current architecture already exposes a single `updateStatus` route, but
 * that route is gated to `COMPANY`/`ADMIN` and centralises the "company pushes
 * the pipeline forward" path. Letting a student write to it without a
 * dedicated endpoint meant anyone could craft a request that updated an
 * application they did not own (e.g. by guessing the company-side schema),
 * and there is no way to attach a student-specific "respond" semantic to a
 * status it does not own.
 *
 * The dedicated handler:
 *   1. Loads the application.
 *   2. Verifies the caller is the owning student.
 *   3. Rejects anything that is not `SELECTED` — including an already-accepted
 *      or already-rejected offer, which prevents a student from oscillating
 *      the application back into a placement.
 *   4. Routes the transition through `validateInternshipTransition` so the
 *      existing JOB/INTERNSHIP transition maps remain the single source of
 *      truth.
 *   5. Persists `offerRespondedAt`, appends a timeline entry and notifies the
 *      company so the placement outcome is visible to the institution.
 */
export async function respondToOffer(
  userId: string,
  role: Role,
  applicationId: string,
  response: StudentOfferResponse,
) {
  if (role !== 'STUDENT') {
    throw AppError.forbidden('Only students can respond to placement offers');
  }

  const app = await Application.findById(applicationId).populate({
    path: 'student',
    populate: { path: 'user', select: '_id' },
  });
  if (!app) throw AppError.notFound('Application not found');

  if (!app.student) {
    throw AppError.forbidden('This application has no student applicant');
  }
  const studentProfile = app.student as unknown as { _id: unknown; user: { _id: unknown } | null };
  const requesterStudent = await getMyStudentProfile(userId);
  if (String(studentProfile._id) !== String(requesterStudent._id)) {
    throw AppError.forbidden('Not your application');
  }

  if (app.status !== 'SELECTED') {
    throw AppError.badRequest('Only selected applications can receive an offer response');
  }

  // Phase 6B — enforce offer expiry. The deadline (if any) is the company's
  // chosen response window; once it has passed, the offer is treated as
  // expired and the student can no longer accept/reject.
  if (isOfferExpired(app)) {
    throw AppError.badRequest('The offer has expired and can no longer be accepted or declined');
  }

  const type = app.opportunityType as OpportunityType;
  const newStatus = nextStatusFromResponse(response);

  const transition = validateInternshipTransition({
    currentStatus: 'SELECTED',
    newStatus,
    opportunityType: type,
    selectedAt: (app as unknown as { selectedAt?: Date }).selectedAt ?? null,
  });
  if (!transition.valid) {
    throw AppError.badRequest(transition.error ?? 'Invalid offer response transition');
  }

  app.status = newStatus;
  (app as unknown as { offerRespondedAt: Date }).offerRespondedAt = new Date();
  app.timeline.push({
    status: newStatus,
    at: new Date(),
    note:
      response === 'ACCEPT'
        ? 'Student accepted the offer'
        : 'Student declined the offer',
  });
  await app.save();

  // Notify the company. The placement outcome is critical to the company
  // pipeline, so it goes through the existing createNotification helper rather
  // than a new channel.
  const companyUserId = await resolveCompanyUserIdForApp(type, app);
  if (companyUserId) {
    const title = await resolveOpportunityTitle(type, app);
    await createNotification(
      companyUserId,
      response === 'ACCEPT' ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED',
      response === 'ACCEPT' ? 'Offer accepted' : 'Offer declined',
      response === 'ACCEPT'
        ? `The student has accepted your offer for ${title}.`
        : `The student has declined your offer for ${title}.`,
      `/company/applicants/${String(app._id)}`,
    );
  }

  return app.toJSON();
}

async function resolveCompanyUserIdForApp(
  type: OpportunityType,
  app: { opportunity: unknown },
): Promise<string | null> {
  if (type === 'JOB') {
    const job = await Job.findById(app.opportunity).select('company').lean();
    if (!job) return null;
    const company = await CompanyProfile.findById(job.company).select('user').lean();
    return company?.user ? String(company.user) : null;
  }
  if (type === 'INTERNSHIP') {
    const internship = await Internship.findById(app.opportunity).select('company').lean();
    if (!internship) return null;
    const company = await CompanyProfile.findById(internship.company).select('user').lean();
    return company?.user ? String(company.user) : null;
  }
  // Faculty-model opportunities are owned by postedBy directly
  const opp = await FacultyOpportunity.findById(app.opportunity).select('postedBy').lean();
  return opp?.postedBy ? String(opp.postedBy) : null;
}

async function resolveOpportunityTitle(type: OpportunityType, app: { opportunity: unknown }) {
  if (type === 'JOB') {
    const job = await Job.findById(app.opportunity).select('title').lean();
    return job?.title ?? 'the opportunity';
  }
  if (type === 'INTERNSHIP') {
    const internship = await Internship.findById(app.opportunity).select('title').lean();
    return internship?.title ?? 'the opportunity';
  }
  const opp = await FacultyOpportunity.findById(app.opportunity).select('title').lean();
  return opp?.title ?? 'the opportunity';
}

/* ============================================================
   Phase 5B — Post-ONGOING lifecycle
   ============================================================ */

async function assertCompanyOwnsInternship(
  userId: string,
  app: { opportunityType: string; opportunity: unknown },
): Promise<void> {
  if (app.opportunityType !== 'INTERNSHIP') {
    throw AppError.badRequest('This operation is only for internship applications');
  }
  const company = await getMyCompanyProfile(userId);
  const opp = await Internship.findById(app.opportunity).select('company');
  if (!opp) throw AppError.notFound('Internship not found');
  if (String(opp.company) !== String(company._id)) {
    throw AppError.forbidden('Not your application');
  }
}

export interface AssignMentorInput {
  mentorUserId: string;
}

/**
 * Assigns a mentor (User with a MentorProfile) to a selected/started/ongoing internship.
 * Only the owning COMPANY (or ADMIN) may assign.
 */
export async function assignMentorToApplication(
  userId: string,
  role: Role,
  applicationId: string,
  input: AssignMentorInput,
) {
  const app = await Application.findById(applicationId)
    .populate({ path: 'student', populate: { path: 'user', select: '_id' } });
  if (!app) throw AppError.notFound('Application not found');

  if (app.opportunityType !== 'INTERNSHIP') {
    throw AppError.badRequest('Mentor assignment is only for internship applications');
  }

  // Ownership
  if (role === 'COMPANY') {
    await assertCompanyOwnsInternship(userId, app);
  } else if (role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  const eligibleStatuses = ['INTERNSHIP_STARTED', 'ONGOING', 'COMPLETED'];
  if (!eligibleStatuses.includes(app.status)) {
    throw AppError.badRequest(
      'Mentor can only be assigned to started, ongoing, or completed internships',
    );
  }

  // Verify mentor exists and has a MentorProfile
  const mentorProfile = await MentorProfile.findOne({ user: input.mentorUserId });
  if (!mentorProfile) {
    throw AppError.badRequest('The selected user is not registered as a mentor');
  }

  const mentorUser = await User.findById(input.mentorUserId).select('email role');
  if (!mentorUser) throw AppError.notFound('Mentor user not found');

  app.mentor = mentorProfile.user as unknown as typeof app.mentor;
  app.mentorAssignedAt = new Date();
  app.timeline.push({
    status: app.status,
    at: new Date(),
    note: 'Mentor assigned',
  });
  await app.save();

  // Notify student
  const student = app.student as unknown as { user: { _id: unknown } } | null;
  if (student?.user) {
    const opp = await Internship.findById(app.opportunity).select('title');
    const title = opp?.title ?? 'the internship';
    await createNotification(
      String(student.user._id),
      'MENTOR_ASSIGNED',
      'A mentor has been assigned',
      `A mentor has been assigned to your internship (${title}).`,
      `/student/applications/${String(app._id)}`,
    );
  }
  // Notify mentor
  await createNotification(
    input.mentorUserId,
    'MENTOR_ASSIGNED',
    'You have been assigned as a mentor',
    'You have been assigned to mentor an active internship.',
    `/faculty/applications/${String(app._id)}/reports`,
  );

  return app.toJSON();
}

/**
 * Removes the assigned mentor from an internship application.
 */
export async function removeMentorFromApplication(
  userId: string,
  role: Role,
  applicationId: string,
) {
  const app = await Application.findById(applicationId);
  if (!app) throw AppError.notFound('Application not found');

  if (role === 'COMPANY') {
    await assertCompanyOwnsInternship(userId, app);
  } else if (role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  if (!app.mentor) {
    throw AppError.badRequest('No mentor is currently assigned');
  }

  app.mentor = undefined;
  app.mentorAssignedAt = undefined;
  await app.save();
  return app.toJSON();
}

export interface CompleteInternshipInput {
  completionNotes?: string;
  rating?: number;
}

/**
 * Transitions an ONGOING internship to COMPLETED. Only the owning company (or
 * ADMIN) may complete, and the application must currently be ONGOING.
 */
export async function completeInternshipForApplication(
  userId: string,
  role: Role,
  applicationId: string,
  input: CompleteInternshipInput = {},
) {
  const app = await Application.findById(applicationId)
    .populate({ path: 'student', populate: { path: 'user', select: '_id' } });
  if (!app) throw AppError.notFound('Application not found');

  if (app.opportunityType !== 'INTERNSHIP') {
    throw AppError.badRequest('This operation is only for internship applications');
  }

  if (role === 'COMPANY') {
    await assertCompanyOwnsInternship(userId, app);
  } else if (role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  // Reuse the lifecycle transition validator
  const transition = validateInternshipTransition({
    currentStatus: app.status as ApplicationStatus,
    newStatus: 'COMPLETED',
    opportunityType: 'INTERNSHIP',
    completedAt: (app as unknown as { completedAt?: Date }).completedAt ?? null,
  });
  if (!transition.valid) {
    throw AppError.badRequest(transition.error ?? 'Cannot complete this internship');
  }

  app.status = 'COMPLETED';
  (app as unknown as { completedAt: Date }).completedAt =
    transition.dateUpdates?.completedAt ?? new Date();
  app.timeline.push({
    status: 'COMPLETED',
    at: new Date(),
    ...(input.completionNotes ? { note: input.completionNotes } : { note: 'Internship completed' }),
  });
  await app.save();

  // Notify student
  const student = app.student as unknown as { user: { _id: unknown } } | null;
  if (student?.user) {
    const opp = await Internship.findById(app.opportunity).select('title');
    const title = opp?.title ?? 'the internship';
    await createNotification(
      String(student.user._id),
      'INTERNSHIP_COMPLETED',
      'Internship completed',
      `Congratulations! You have successfully completed your internship (${title}).`,
      `/student/applications/${String(app._id)}`,
    );
    await createNotification(
      String(student.user._id),
      'CERTIFICATE_AVAILABLE',
      'Certificate available',
      'Your completion certificate is now available to download.',
      `/student/applications/${String(app._id)}`,
    );
  }

  return app.toJSON();
}

/**
 * Returns the active interns (INTERNSHIP_STARTED or ONGOING) for the calling company.
 * Includes mentor and progress report counts.
 */
export async function listActiveInternsForCompany(
  userId: string,
  role: Role,
  pag: PaginationInput,
) {
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  if (role !== 'COMPANY' && role !== 'ADMIN') {
    throw AppError.forbidden('Only COMPANY or ADMIN may view active interns');
  }

  const companyId = role === 'COMPANY' ? await getMyCompanyProfile(userId) : null;
  const internships = companyId
    ? await Internship.find({ company: companyId._id }).select('_id').lean()
    : await Internship.find({}).select('_id').lean();
  const internshipIds = internships.map((i) => i._id);
  if (internshipIds.length === 0) {
    return buildPaginated([], 0, page, pageSize);
  }

  const where = {
    opportunityType: 'INTERNSHIP',
    opportunity: { $in: internshipIds },
    status: { $in: ['INTERNSHIP_STARTED', 'ONGOING'] },
  };

  const [rows, total] = await Promise.all([
    Application.find(where)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'student', populate: { path: 'user', select: '_id email' } })
      .populate('mentor', 'email role')
      .lean(),
    Application.countDocuments(where),
  ]);

  // Enrich with opportunity title, report counts
  const appIds = rows.map((r) => r._id);
  const oppIds = rows.map((r) => r.opportunity);
  const [opps, reportCounts, mentorProfiles] = await Promise.all([
    Internship.find({ _id: { $in: oppIds } }).select('title durationMonths stipend currency').lean(),
    appIds.length
      ? InterimReport.aggregate<{ _id: unknown; count: number }>([
          { $match: { application: { $in: appIds } } },
          { $group: { _id: '$application', count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
    // Pull mentor profiles for assigned mentors
    rows
      .map((r) => r.mentor)
      .filter((m) => Boolean(m))
      .length
      ? MentorProfile.find({ user: { $in: rows.map((r) => r.mentor).filter(Boolean) } })
          .select('user bio expertise yearsExperience')
          .lean()
      : Promise.resolve([]),
  ]);
  const oppMap = new Map(opps.map((o) => [String(o._id), o]));
  const reportMap = new Map(reportCounts.map((r) => [String(r._id), r.count]));
  const mentorMap = new Map(mentorProfiles.map((m) => [String(m.user), m]));

  const items = rows.map((r) => {
    const opp = oppMap.get(String(r.opportunity));
    const mentorRef = r.mentor as unknown as { _id?: unknown } | null;
    const mentorProfile = mentorRef?._id
      ? mentorMap.get(String(mentorRef._id))
      : null;
    const student = r.student as unknown as {
      _id: unknown;
      fullName?: string;
      user?: { _id: unknown; email?: string };
    } | null;
    return {
      id: String(r._id),
      status: r.status,
      startDate: r.startDate,
      expectedEndDate: r.expectedEndDate,
      startedAt: r.startedAt,
      reportCount: reportMap.get(String(r._id)) ?? 0,
      opportunity: {
        id: String(r.opportunity),
        title: opp?.title ?? '',
        durationMonths: opp?.durationMonths,
        stipend: opp?.stipend,
        currency: opp?.currency,
      },
      student: student
        ? {
            id: String(student._id),
            fullName: student.fullName ?? '',
            email: student.user?.email ?? '',
          }
        : null,
      mentor: mentorProfile
        ? {
            userId: String(mentorProfile.user),
            bio: mentorProfile.bio,
            expertise: mentorProfile.expertise,
            yearsExperience: mentorProfile.yearsExperience,
          }
        : null,
    };
  });

  return buildPaginated(items, total, page, pageSize);
}

/**
 * List internships assigned to the calling mentor (Faculty/mentor user).
 */
export async function listAssignedInternsForMentor(
  userId: string,
  pag: PaginationInput,
) {
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const where = {
    opportunityType: 'INTERNSHIP',
    mentor: userId,
    status: { $in: ['SELECTED', 'INTERNSHIP_STARTED', 'ONGOING', 'COMPLETED'] },
  };
  const [rows, total] = await Promise.all([
    Application.find(where)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'student', populate: { path: 'user', select: '_id email' } })
      .lean(),
    Application.countDocuments(where),
  ]);
  const appIds = rows.map((r) => r._id);
  const oppIds = rows.map((r) => r.opportunity);
  const [opps, reportCounts] = await Promise.all([
    Internship.find({ _id: { $in: oppIds } })
      .select('title durationMonths')
      .populate('company', 'companyName')
      .lean(),
    appIds.length
      ? InterimReport.aggregate<{ _id: unknown; count: number }>([
          { $match: { application: { $in: appIds } } },
          { $group: { _id: '$application', count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ]);
  const oppMap = new Map(opps.map((o) => [String(o._id), o]));
  const reportMap = new Map(reportCounts.map((r) => [String(r._id), r.count]));

  const items = rows.map((r) => {
    const opp = oppMap.get(String(r.opportunity));
    const oppTyped = opp as unknown as {
      title?: string;
      durationMonths?: number;
      company?: { _id?: unknown; companyName?: string };
    } | null;
    const student = r.student as unknown as {
      _id: unknown;
      fullName?: string;
      user?: { email?: string };
    } | null;
    return {
      id: String(r._id),
      status: r.status,
      startDate: r.startDate,
      expectedEndDate: r.expectedEndDate,
      startedAt: r.startedAt,
      completedAt: (r as unknown as { completedAt?: Date }).completedAt,
      reportCount: reportMap.get(String(r._id)) ?? 0,
      opportunity: {
        id: String(r.opportunity),
        title: oppTyped?.title ?? '',
        durationMonths: oppTyped?.durationMonths,
        company: oppTyped?.company?.companyName ?? '',
      },
      student: student
        ? {
            id: String(student._id),
            fullName: student.fullName ?? '',
            email: student.user?.email ?? '',
          }
        : null,
    };
  });

  return buildPaginated(items, total, page, pageSize);
}

/**
 * Returns the resolved mentor (User + MentorProfile) for a given application,
 * or null if none is assigned. Authorization: student, owning company, mentor,
 * admin.
 */
export async function getMentorForApplication(
  applicationId: string,
  requester: { userId: string; role: Role },
) {
  const app = await Application.findById(applicationId)
    .populate('mentor', 'email role')
    .lean();
  if (!app) throw AppError.notFound('Application not found');
  if (app.opportunityType !== 'INTERNSHIP') {
    throw AppError.notFound('Not an internship application');
  }

  // Authorization
  if (requester.role === 'STUDENT') {
    const student = await getMyStudentProfile(requester.userId);
    if (String(app.student) !== String(student._id)) {
      throw AppError.forbidden('Not your application');
    }
  } else if (requester.role === 'COMPANY') {
    const company = await getMyCompanyProfile(requester.userId);
    const opp = await Internship.findById(app.opportunity).select('company').lean();
    if (!opp || String(opp.company) !== String(company._id)) {
      throw AppError.forbidden('Not your application');
    }
  } else if (requester.role === 'FACULTY') {
    if (!app.mentor || String(app.mentor) !== requester.userId) {
      throw AppError.forbidden('Not your assigned internship');
    }
  } else if (requester.role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  if (!app.mentor) return null;
  const mentorUserId = String(
    (app.mentor as unknown as { _id?: unknown })._id ?? app.mentor,
  );
  const [mentorUser, mentorProfile, fullName] = await Promise.all([
    User.findById(mentorUserId).select('email role').lean(),
    MentorProfile.findOne({ user: mentorUserId }).select('bio expertise yearsExperience availability').lean(),
    resolveDisplayName(mentorUserId),
  ]);
  return {
    userId: mentorUserId,
    email: mentorUser?.email ?? '',
    fullName,
    bio: mentorProfile?.bio,
    expertise: mentorProfile?.expertise ?? [],
    yearsExperience: mentorProfile?.yearsExperience,
    availability: mentorProfile?.availability,
  };
}

async function resolveDisplayName(userId: string): Promise<string> {
  const u = await User.findById(userId).select('email role').lean();
  if (!u) return 'Unknown';
  if (u.role === 'FACULTY') {
    const f = await FacultyProfile.findOne({ user: userId }).select('fullName').lean();
    if (f?.fullName) return String(f.fullName);
  }
  return String(u.email ?? 'Unknown').split('@')[0] ?? 'Unknown';
}

/* ============================================================
   Phase 6B — Offer details, expiry, withdrawal, offer letter
   ============================================================ */

async function assertCompanyOwnsApplication(
  userId: string,
  app: { _id: unknown; opportunityType: string; opportunity: unknown },
): Promise<void> {
  const type = app.opportunityType as OpportunityType;
  if (usesFacultyModel(type)) {
    const opp = await FacultyOpportunity.findById(app.opportunity)
      .select('hostType host postedBy')
      .lean();
    const company = await CompanyProfile.findOne({ user: userId }).select('_id').lean();
    if (!company) throw AppError.forbidden('Company profile not found');
    const isHost = opp?.hostType === 'COMPANY' && String(opp.host) === String(company._id);
    const isPoster = opp && String(opp.postedBy) === userId;
    if (!isHost && !isPoster) throw AppError.forbidden('Not your application');
    return;
  }
  const company = await CompanyProfile.findOne({ user: userId }).select('_id').lean();
  if (!company) throw AppError.forbidden('Company profile not found');
  const OppModel = opportunityModel(type);
  const opp = await OppModel.findById(app.opportunity).select('company').lean();
  if (!opp || String(opp.company) !== String(company._id)) {
    throw AppError.forbidden('Not your application');
  }
}

export interface SetOfferDetailsInput {
  offeredSalary?: number;
  currency?: string;
  joiningDate?: string;
  offerTerms?: string;
  offerExpiresAt?: string;
}

/**
 * Phase 6B — set or update candidate-specific offer details on an application.
 *
 * The job's `salary`/`salaryCurrency` stay as the public posting; this method
 * stores the actual package being offered to *this* candidate. Only the owning
 * COMPANY (or ADMIN) may write, and only when the application is in a state
 * that can carry an offer (SELECTED). Once the student has accepted/rejected,
 * the offer details are frozen — companies cannot retroactively rewrite what
 * was already on the table.
 */
export async function setOfferDetails(
  userId: string,
  role: Role,
  applicationId: string,
  input: SetOfferDetailsInput,
) {
  const app = await Application.findById(applicationId)
    .populate({ path: 'student', populate: { path: 'user', select: '_id' } });
  if (!app) throw AppError.notFound('Application not found');

  if (role === 'COMPANY') {
    await assertCompanyOwnsApplication(userId, app);
  } else if (role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  if (app.status !== 'SELECTED') {
    throw AppError.badRequest('Offer details can only be set while the application is SELECTED');
  }

  const offersExpired = isOfferExpired(app);
  if (offersExpired) {
    throw AppError.badRequest('Cannot update offer details after the offer has expired');
  }

  // At least one of the fields must be provided — otherwise the call is a
  // no-op the API should reject.
  if (
    input.offeredSalary === undefined &&
    input.currency === undefined &&
    input.joiningDate === undefined &&
    input.offerTerms === undefined &&
    input.offerExpiresAt === undefined
  ) {
    throw AppError.badRequest('At least one offer detail field is required');
  }

  // Validate joining date
  if (input.joiningDate) {
    const joining = new Date(input.joiningDate);
    if (isNaN(joining.getTime())) {
      throw AppError.badRequest('Invalid joining date');
    }
  }

  // Validate offer expiry
  if (input.offerExpiresAt) {
    const expiry = new Date(input.offerExpiresAt);
    if (isNaN(expiry.getTime())) {
      throw AppError.badRequest('Invalid offer expiry date');
    }
    if (expiry.getTime() <= Date.now()) {
      throw AppError.badRequest('Offer expiry must be in the future');
    }
    (app as unknown as { offerExpiresAt: Date }).offerExpiresAt = expiry;
  }

  const existingDetails =
    (app as unknown as { offerDetails?: Record<string, unknown> }).offerDetails ?? {};
  const next: Record<string, unknown> = { ...existingDetails };
  if (input.offeredSalary !== undefined) next.offeredSalary = input.offeredSalary;
  if (input.currency !== undefined) next.currency = input.currency;
  if (input.joiningDate !== undefined) next.joiningDate = new Date(input.joiningDate);
  if (input.offerTerms !== undefined) next.offerTerms = input.offerTerms;
  next.updatedAt = new Date();

  (app as unknown as { offerDetails: Record<string, unknown> }).offerDetails = next;
  app.timeline.push({
    status: app.status,
    at: new Date(),
    note: 'Offer details updated',
  });
  await app.save();

  // Notify the student so they see the new package in the application view.
  const student = app.student as unknown as { user: { _id: unknown } } | null;
  if (student?.user) {
    const title = await resolveOpportunityTitle(app.opportunityType as OpportunityType, app);
    await createNotification(
      String(student.user._id),
      'OFFER_DETAILS_UPDATED',
      'Offer details updated',
      `The company has updated the offer details for ${title}.`,
      `/student/applications/${String(app._id)}`,
    );
  }

  return app.toJSON();
}

/**
 * Phase 6B — student-initiated withdrawal of an accepted offer.
 *
 * The lifecycle now goes:
 *   OFFER_ACCEPTED → WITHDRAWAL_REQUESTED → OFFER_ACCEPTED (rejected by company)
 *   OFFER_ACCEPTED → WITHDRAWAL_REQUESTED → (admin resolves later)
 *
 * The middle state gives the institution and company a record of the request
 * and prevents the student from repeatedly submitting the same request.
 * Only the owning student may submit; duplicate requests are blocked.
 */
export async function requestOfferWithdrawal(
  userId: string,
  role: Role,
  applicationId: string,
  reason?: string,
) {
  if (role !== 'STUDENT') {
    throw AppError.forbidden('Only the student applicant can request a withdrawal');
  }

  const app = await Application.findById(applicationId).populate({
    path: 'student',
    populate: { path: 'user', select: '_id' },
  });
  if (!app) throw AppError.notFound('Application not found');

  if (!app.student) {
    throw AppError.forbidden('This application has no student applicant');
  }
  const studentProfile = app.student as unknown as { _id: unknown };
  const requester = await getMyStudentProfile(userId);
  if (String(studentProfile._id) !== String(requester._id)) {
    throw AppError.forbidden('Not your application');
  }

  if (app.status === 'WITHDRAWAL_REQUESTED') {
    throw AppError.conflict('A withdrawal request is already pending for this application');
  }

  if (app.status !== 'OFFER_ACCEPTED') {
    throw AppError.badRequest('Withdrawal can only be requested after the offer has been accepted');
  }

  (app as unknown as { withdrawalRequestedAt: Date }).withdrawalRequestedAt = new Date();
  if (reason) {
    (app as unknown as { withdrawalReason: string }).withdrawalReason = reason;
  }
  app.status = 'WITHDRAWAL_REQUESTED';
  app.timeline.push({
    status: 'WITHDRAWAL_REQUESTED',
    at: new Date(),
    note: reason ? `Student requested withdrawal: ${reason}` : 'Student requested withdrawal',
  });
  await app.save();

  // Notify the company. A withdrawal-after-acceptance is a placement outcome
  // the company needs to see.
  const type = app.opportunityType as OpportunityType;
  const companyUserId = await resolveCompanyUserIdForApp(type, app);
  if (companyUserId) {
    const title = await resolveOpportunityTitle(type, app);
    await createNotification(
      companyUserId,
      'WITHDRAWAL_REQUESTED',
      'Withdrawal requested',
      `The student has requested to withdraw from the accepted offer for ${title}.`,
      `/company/applicants/${String(app._id)}`,
    );
  }

  return app.toJSON();
}

export interface AttachOfferLetterInput {
  documentId: string;
}

/**
 * Phase 6B — attach an offer letter document to an application.
 *
 * Reuses the existing Document system (uploaded separately through the
 * documents API). This method just wires the document id into the
 * application. The document's `application` field is set so the existing
 * access check can resolve it.
 */
export async function attachOfferLetter(
  userId: string,
  role: Role,
  applicationId: string,
  input: AttachOfferLetterInput,
) {
  const app = await Application.findById(applicationId);
  if (!app) throw AppError.notFound('Application not found');

  if (role === 'COMPANY') {
    await assertCompanyOwnsApplication(userId, app);
  } else if (role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  if (app.status !== 'SELECTED') {
    throw AppError.badRequest('Offer letter can only be attached while the application is SELECTED');
  }

  // Load the document, verify it belongs to the same company and is an offer
  // letter. The company is the `user` of the document — they uploaded it.
  const company = await CompanyProfile.findOne({ user: userId }).select('_id user').lean();
  if (!company) throw AppError.forbidden('Company profile not found');

  const doc = await DocumentModel.findById(input.documentId);
  if (!doc) throw AppError.notFound('Document not found');
  if (String(doc.user) !== String(company.user)) {
    throw AppError.forbidden('You can only attach your own documents as offer letters');
  }
  if (doc.documentType !== 'OFFER_LETTER') {
    throw AppError.badRequest('Document is not an offer letter');
  }

  (app as unknown as { offerLetter: unknown }).offerLetter = doc._id;
  // Also tag the document with the application id so the document access
  // check can verify it back-references the right offer.
  (doc as unknown as { application: unknown }).application = app._id;
  await doc.save();
  app.timeline.push({
    status: app.status,
    at: new Date(),
    note: 'Offer letter attached',
  });
  await app.save();

  return app.toJSON();
}

/**
 * Phase 6B — read the offer letter metadata, if any, for an application.
 *
 * Resolves the company user via a back-reference so the student (and
 * institution, via existing document access) can download the offer letter.
 */
export async function getOfferLetterForApplication(
  applicationId: string,
  requester: { userId: string; role: Role },
) {
  const app = await Application.findById(applicationId)
    .populate({ path: 'student', populate: { path: 'user', select: '_id' } });
  if (!app) throw AppError.notFound('Application not found');

  // Authorization: student who owns the app, the company that owns the
  // posting, an admin, or the institution of the student.
  if (requester.role === 'STUDENT') {
    if (!app.student) throw AppError.forbidden('Not your application');
    const studentProfile = app.student as unknown as { _id: unknown; user: { _id: unknown } };
    const myProfile = await getMyStudentProfile(requester.userId);
    if (String(studentProfile._id) !== String(myProfile._id)) {
      throw AppError.forbidden('Not your application');
    }
  } else if (requester.role === 'COMPANY') {
    await assertCompanyOwnsApplication(requester.userId, app);
  } else if (requester.role === 'INSTITUTION') {
    if (!app.student) throw AppError.forbidden('Not your application');
    const user = await User.findById(requester.userId).select('institution').lean();
    if (!user?.institution) throw AppError.forbidden('Not your application');
    const studentProfile = app.student as unknown as { institution?: unknown };
    if (!studentProfile || String(studentProfile.institution) !== String(user.institution)) {
      throw AppError.forbidden('Not your application');
    }
  } else if (requester.role !== 'ADMIN') {
    throw AppError.forbidden('Insufficient role');
  }

  const offerLetterId = (app as unknown as { offerLetter?: unknown }).offerLetter;
  if (!offerLetterId) return null;

  const doc = await DocumentModel.findById(String(offerLetterId));
  if (!doc) return null;
  return {
    id: String(doc._id),
    filename: doc.filename,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
  };
}
