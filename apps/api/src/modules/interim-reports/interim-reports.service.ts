import type { Role, OpportunityType } from '@aip/config';
import type {
  CreateInterimReportInput,
  MentorFeedbackInput,
  ListInterimReportsQuery,
} from '@aip/validation';
import { AppError } from '../../utils/AppError';
import { applyPagination, buildPaginated } from '../../utils/pagination';
import {
  InterimReport,
  Application,
  StudentProfile,
  CompanyProfile,
  Job,
  Internship,
} from '../../models';

function opportunityModel(type: OpportunityType): typeof Job {
  return (type === 'JOB' ? Job : Internship) as unknown as typeof Job;
}

async function verifyStudentOwnsApp(userId: string, appId: string) {
  const student = await StudentProfile.findOne({ user: userId }).select('_id');
  if (!student) throw AppError.notFound('Student profile not found');
  const app = await Application.findById(appId);
  if (!app) throw AppError.notFound('Application not found');
  if (String(app.student) !== String(student._id)) throw AppError.forbidden('Not your application');
  return { student, app };
}

async function assertAccessToApp(userId: string, role: Role, appId: string) {
  const app = await Application.findById(appId);
  if (!app) throw AppError.notFound('Application not found');
  if (role === 'STUDENT') {
    const student = await StudentProfile.findOne({ user: userId }).select('_id');
    if (!student || String(app.student) !== String(student._id)) {
      throw AppError.forbidden('Not your application');
    }
    return app;
  }
  if (role === 'COMPANY') {
    const company = await CompanyProfile.findOne({ user: userId }).select('_id');
    if (!company) throw AppError.notFound('Company profile not found');
    const OpportunityModel = opportunityModel(app.opportunityType as OpportunityType);
    const opp = await OpportunityModel.findById(app.opportunity).select('company');
    if (!opp || String(opp.company) !== String(company._id)) {
      throw AppError.forbidden('Not your application');
    }
    return app;
  }
  if (role === 'ADMIN') return app;
  throw AppError.forbidden('Insufficient role');
}

export async function createReport(
  studentUserId: string,
  applicationId: string,
  input: CreateInterimReportInput,
) {
  const { student, app } = await verifyStudentOwnsApp(studentUserId, applicationId);
  if (app.status !== 'SELECTED') {
    throw AppError.badRequest('Interim reports require a SELECTED application');
  }
  try {
    const doc = await InterimReport.create({
      application: app._id,
      student: student._id,
      weekNumber: input.weekNumber,
      ...(input.periodStart ? { periodStart: new Date(input.periodStart) } : {}),
      ...(input.periodEnd ? { periodEnd: new Date(input.periodEnd) } : {}),
      ...(input.workDescription ? { workDescription: input.workDescription } : {}),
      ...(input.learnings ? { learnings: input.learnings } : {}),
      ...(input.challenges ? { challenges: input.challenges } : {}),
      ...(typeof input.hoursSpent === 'number' ? { hoursSpent: input.hoursSpent } : {}),
      submittedAt: new Date(),
    });
    return doc.toJSON();
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      throw AppError.conflict('A report for this week already exists');
    }
    throw err;
  }
}

export async function listReportsForApplication(
  appId: string,
  userId: string,
  role: Role,
  filters: ListInterimReportsQuery,
) {
  await assertAccessToApp(userId, role, appId);
  const { page, pageSize, skip, limit } = applyPagination({
    page: filters.page,
    pageSize: filters.pageSize,
  });
  const where = { application: appId };
  const [rows, total] = await Promise.all([
    InterimReport.find(where).sort({ weekNumber: 1 }).skip(skip).limit(limit).lean(),
    InterimReport.countDocuments(where),
  ]);
  const items = rows.map((r) => ({ ...r, id: String(r._id) }));
  return buildPaginated(items, total, page, pageSize);
}

export async function getReport(id: string, userId: string, role: Role) {
  const doc = await InterimReport.findById(id);
  if (!doc) throw AppError.notFound('Report not found');
  await assertAccessToApp(userId, role, String(doc.application));
  return doc.toJSON();
}

export async function addMentorFeedback(
  id: string,
  reviewerUserId: string,
  reviewerRole: Role,
  input: MentorFeedbackInput,
) {
  const doc = await InterimReport.findById(id);
  if (!doc) throw AppError.notFound('Report not found');
  if (reviewerRole !== 'COMPANY' && reviewerRole !== 'ADMIN') {
    throw AppError.forbidden('Only COMPANY or ADMIN may review');
  }
  await assertAccessToApp(reviewerUserId, reviewerRole, String(doc.application));
  doc.mentorFeedback = input.mentorFeedback;
  if (typeof input.mentorRating === 'number') doc.mentorRating = input.mentorRating;
  doc.mentorReviewedAt = new Date();
  doc.mentorReviewedBy = reviewerUserId as unknown as typeof doc.mentorReviewedBy;
  await doc.save();
  return doc.toJSON();
}
