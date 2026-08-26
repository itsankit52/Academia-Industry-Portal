import type {
  CreateApplicationInput,
  UpdateApplicationStatusInput,
} from '@aip/validation';
import type { ApplicationStatus, OpportunityType, Role } from '@aip/config';
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
} from '../../models';
import { applyPagination, buildPaginated, type PaginationInput } from '../../utils/pagination';
import { computeMatch } from '../matching/algorithm';
import { createNotification } from '../notifications/notifications.service';

const STUDENT_OPP_TYPES = new Set<OpportunityType>(['JOB', 'INTERNSHIP', 'PROJECT', 'APPRENTICESHIP']);
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

export async function createApplication(
  userId: string,
  role: Role,
  input: CreateApplicationInput,
) {
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
      FacultyOpportunity.find({ hostType: 'COMPANY', host: company._id }).select('_id opportunityType'),
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

async function enrichApplication(app: Record<string, unknown>): Promise<Record<string, unknown>> {
  const type = app.opportunityType as OpportunityType;
  const oppId = app.opportunity;
  if (!oppId) return app;

  if (usesFacultyModel(type)) {
    const opp = await FacultyOpportunity.findById(String(oppId)).select('title hostType host').lean();
    if (!opp) return app;
    let hostRef: { id: string; name: string } | null = null;
    if (opp.hostType === 'COMPANY') {
      const c = await CompanyProfile.findById(opp.host).select('companyName').lean();
      hostRef = c ? { id: String(c._id), name: c.companyName } : null;
    } else {
      const i = await Institution.findById(opp.host).select('name').lean();
      hostRef = i ? { id: String(i._id), name: i.name } : null;
    }
    return {
      ...app,
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
  if (!opp) return app;
  const company = opp.company as unknown as { _id: unknown; companyName: string } | null;
  return {
    ...app,
    opportunity: {
      id: String(opp._id),
      title: opp.title,
      ...(company ? { company: { id: String(company._id), name: company.companyName } } : {}),
    },
  };
}

export async function getApplicationById(userId: string, role: Role, id: string) {
  const app = await Application.findById(id)
    .populate({ path: 'student', populate: { path: 'user', select: 'email' } })
    .populate({ path: 'faculty', populate: { path: 'user', select: 'email' } })
    .populate('resume');
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
      const opp = await FacultyOpportunity.findById(app.opportunity).select('hostType host postedBy');
      const isHost =
        opp?.hostType === 'COMPANY' && String(opp.host) === String(company._id);
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
      const opp = await FacultyOpportunity.findById(app.opportunity).select('hostType host postedBy');
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

  app.status = input.status;
  app.timeline.push({
    status: input.status,
    at: new Date(),
    ...(input.note ? { note: input.note } : {}),
  });
  await app.save();

  const student = app.student as unknown as { user: { _id: unknown } } | null;
  const faculty = app.faculty as unknown as { user: { _id: unknown } } | null;
  const applicantUserId = student
    ? String(student.user._id)
    : faculty
      ? String(faculty.user._id)
      : null;
  const applicantHome = faculty ? 'faculty' : 'student';

  if (applicantUserId && (input.status === 'SELECTED' || input.status === 'REJECTED')) {
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
    } else {
      await createNotification(
        applicantUserId,
        'APPLICATION_REJECTED',
        'Application not selected',
        `Your application for ${title} was not selected this time.`,
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
  };
  aiNarrative?: string;
}

export async function getCandidateDetails(
  applicationId: string,
  requester: { userId: string; role: Role },
): Promise<CandidateDetailsView> {
  const app = await Application.findById(applicationId).populate('resume');
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
      timeline: app.timeline ?? [],
      createdAt: (app as unknown as { createdAt: Date }).createdAt,
    },
  };
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
  if (app.status !== 'SELECTED') {
    throw AppError.badRequest('Certificate available only for SELECTED applications');
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
