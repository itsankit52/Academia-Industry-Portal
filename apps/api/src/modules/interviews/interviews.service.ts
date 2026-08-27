import type { CreateInterviewInput, UpdateInterviewInput } from '@aip/validation';
import type { OpportunityType, Role } from '@aip/config';
import { AppError } from '../../utils/AppError';
import {
  Interview,
  Application,
  Job,
  Internship,
  CompanyProfile,
  StudentProfile,
} from '../../models';
import { applyPagination, buildPaginated, type PaginationInput } from '../../utils/pagination';
import { summarizeApplication } from '../applications/applications.service';
import { createNotification } from '../notifications/notifications.service';

function opportunityModel(type: OpportunityType): typeof Job {
  return (type === 'JOB' ? Job : Internship) as unknown as typeof Job;
}

async function getStudentUserIdFromApplication(appId: string): Promise<string | null> {
  const app = await Application.findById(appId).populate({
    path: 'student',
    populate: { path: 'user', select: '_id' },
  });
  if (!app) return null;
  const student = app.student as unknown as { user: { _id: unknown } | null } | null;
  return student?.user ? String(student.user._id) : null;
}

async function assertCompanyOwnsApplication(userId: string, appId: string) {
  const company = await CompanyProfile.findOne({ user: userId }).select('_id');
  if (!company) throw AppError.forbidden('Company profile not found');
  const app = await Application.findById(appId);
  if (!app) throw AppError.notFound('Application not found');
  const OpportunityModel = opportunityModel(app.opportunityType as OpportunityType);
  const opp = await OpportunityModel.findById(app.opportunity).select('company');
  if (!opp || String(opp.company) !== String(company._id)) {
    throw AppError.forbidden('Not your application');
  }
  return app;
}

export async function createInterview(userId: string, role: Role, input: CreateInterviewInput) {
  const app =
    role === 'COMPANY'
      ? await assertCompanyOwnsApplication(userId, input.applicationId)
      : await Application.findById(input.applicationId);
  if (!app) throw AppError.notFound('Application not found');

  const interview = await Interview.create({
    application: app._id,
    mode: input.mode,
    scheduledAt: new Date(input.scheduledAt),
    durationMinutes: input.durationMinutes,
    ...(input.meetingLink ? { meetingLink: input.meetingLink } : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(input.interviewer ? { interviewer: input.interviewer } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  });

  app.status = 'INTERVIEW_SCHEDULED';
  app.timeline.push({
    status: 'INTERVIEW_SCHEDULED',
    at: new Date(),
    note: 'Interview scheduled',
  });
  await app.save();

  const studentUserId = await getStudentUserIdFromApplication(String(app._id));
  if (studentUserId) {
    await createNotification(
      studentUserId,
      'INTERVIEW_SCHEDULED',
      'Interview scheduled',
      `Your interview is scheduled for ${new Date(input.scheduledAt).toISOString()}.`,
      `/student/interviews/${String(interview._id)}`,
    );
  }
  return interview.toJSON();
}

export interface InterviewListFilters {
  status?: string;
  from?: string;
  to?: string;
}

/**
 * `@aip/types` declares an `Interview` as carrying an `applicationId`,
 * `candidateName`, `opportunityTitle` and `companyName`; the schema stores none of
 * them, only the `application` ref. Those four are exactly what the interview
 * cards and the cancel dialog render, so they showed empty headers and asked
 * "Cancel the interview with undefined?". Resolve them from the application the
 * interview already points at, through the applications service, so an interview
 * and the applicants table can never disagree about who a candidate is.
 */
async function withApplicationSummary(
  iv: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!iv.application) return iv;
  const summary = await summarizeApplication(String(iv.application));
  return summary ? { ...iv, ...summary } : iv;
}

export async function listInterviews(
  userId: string,
  role: Role,
  pag: PaginationInput,
  filters: InterviewListFilters,
) {
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) range.$gte = new Date(filters.from);
    if (filters.to) range.$lte = new Date(filters.to);
    where.scheduledAt = range;
  }

  if (role === 'STUDENT') {
    const student = await StudentProfile.findOne({ user: userId }).select('_id');
    if (!student) throw AppError.notFound('Student profile not found');
    const apps = await Application.find({ student: student._id }).select('_id');
    where.application = { $in: apps.map((a) => a._id) };
  } else if (role === 'COMPANY') {
    const company = await CompanyProfile.findOne({ user: userId }).select('_id');
    if (!company) throw AppError.notFound('Company profile not found');
    const [jobs, internships] = await Promise.all([
      Job.find({ company: company._id }).select('_id'),
      Internship.find({ company: company._id }).select('_id'),
    ]);
    const jobIds = jobs.map((j) => j._id);
    const internshipIds = internships.map((i) => i._id);
    const apps = await Application.find({
      $or: [
        { opportunityType: 'JOB', opportunity: { $in: jobIds } },
        { opportunityType: 'INTERNSHIP', opportunity: { $in: internshipIds } },
      ],
    }).select('_id');
    where.application = { $in: apps.map((a) => a._id) };
  }

  const [rows, total] = await Promise.all([
    Interview.find(where).sort(sort).skip(skip).limit(limit),
    Interview.countDocuments(where),
  ]);
  const items = await Promise.all(rows.map((r) => withApplicationSummary(r.toJSON())));
  return buildPaginated(items, total, page, pageSize);
}

async function assertInterviewAccess(userId: string, role: Role, iv: { application?: unknown }) {
  const app = await Application.findById(iv.application);
  if (!app) throw AppError.notFound('Application not found');
  if (role === 'STUDENT') {
    const student = await StudentProfile.findOne({ user: userId }).select('_id');
    if (!student || String(app.student) !== String(student._id)) {
      throw AppError.forbidden('Not your interview');
    }
  } else if (role === 'COMPANY') {
    const company = await CompanyProfile.findOne({ user: userId }).select('_id');
    if (!company) throw AppError.forbidden('Company profile not found');
    const OpportunityModel = opportunityModel(app.opportunityType as OpportunityType);
    const opp = await OpportunityModel.findById(app.opportunity).select('company');
    if (!opp || String(opp.company) !== String(company._id)) {
      throw AppError.forbidden('Not your interview');
    }
  }
}

export async function getInterviewById(userId: string, role: Role, id: string) {
  const iv = await Interview.findById(id);
  if (!iv) throw AppError.notFound('Interview not found');
  await assertInterviewAccess(userId, role, iv);
  return withApplicationSummary(iv.toJSON());
}

export async function updateInterview(
  userId: string,
  role: Role,
  id: string,
  patch: UpdateInterviewInput,
) {
  const iv = await Interview.findById(id);
  if (!iv) throw AppError.notFound('Interview not found');
  if (role === 'COMPANY') {
    await assertCompanyOwnsApplication(userId, String(iv.application));
  }

  const prevStatus = iv.status;
  if (patch.mode !== undefined) iv.mode = patch.mode;
  if (patch.scheduledAt !== undefined) iv.scheduledAt = new Date(patch.scheduledAt);
  if (patch.durationMinutes !== undefined) iv.durationMinutes = patch.durationMinutes;
  if (patch.meetingLink !== undefined) iv.meetingLink = patch.meetingLink;
  if (patch.location !== undefined) iv.location = patch.location;
  if (patch.interviewer !== undefined) iv.interviewer = patch.interviewer;
  if (patch.notes !== undefined) iv.notes = patch.notes;
  if (patch.status !== undefined) iv.status = patch.status;
  if (patch.feedback !== undefined) iv.feedback = patch.feedback;
  await iv.save();

  if (
    patch.status &&
    patch.status !== prevStatus &&
    (patch.status === 'RESCHEDULED' || patch.status === 'CANCELLED')
  ) {
    const studentUserId = await getStudentUserIdFromApplication(String(iv.application));
    if (studentUserId) {
      const label = patch.status.toLowerCase();
      await createNotification(
        studentUserId,
        'INTERVIEW_UPDATED',
        `Interview ${label}`,
        `Your interview has been ${label}.`,
        `/student/interviews/${String(iv._id)}`,
      );
    }
  }
  return iv.toJSON();
}

export async function deleteInterview(id: string) {
  const res = await Interview.deleteOne({ _id: id });
  if (res.deletedCount === 0) throw AppError.notFound('Interview not found');
}
