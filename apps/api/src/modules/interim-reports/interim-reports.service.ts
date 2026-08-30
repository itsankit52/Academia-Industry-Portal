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
  User,
  MentorProfile,
} from '../../models';
import { createNotification } from '../notifications/notifications.service';

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
  if (role === 'FACULTY') {
    // Faculty can access if assigned as mentor
    if (app.mentor && String(app.mentor) === userId) return app;
    throw AppError.forbidden('Not authorized for this application');
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
  // Allow reports for SELECTED, INTERNSHIP_STARTED, or ONGOING (Phase 5B)
  const validStatuses = ['SELECTED', 'INTERNSHIP_STARTED', 'ONGOING'];
  if (!validStatuses.includes(app.status)) {
    throw AppError.badRequest(
      'Progress reports can only be submitted for selected or active internships',
    );
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

    // Notify mentor (if assigned) and company
    const studentProfile = await StudentProfile.findById(student._id).select('fullName');
    const studentName = studentProfile?.fullName ?? 'The student';

    // Get opportunity title
    const OppModel = opportunityModel(app.opportunityType as OpportunityType);
    const opp = await OppModel.findById(app.opportunity).select('title').lean();
    const oppTitle = (opp as unknown as { title?: string })?.title ?? 'the internship';

    // Notify company
    const OppModel2 = opportunityModel(app.opportunityType as OpportunityType);
    const opp2 = await OppModel2.findById(app.opportunity)
      .populate('company', 'user')
      .select('company')
      .lean();
    const companyUser = (opp2 as unknown as { company?: { user?: string } })?.company?.user;
    if (companyUser) {
      await createNotification(
        String(companyUser),
        'PROGRESS_REPORT_SUBMITTED',
        'New progress report submitted',
        `${studentName} submitted progress report (Week ${input.weekNumber}) for ${oppTitle}.`,
        `/company/applications/${app._id}/reports`,
      );
    }

    // Notify mentor if assigned
    if (app.mentor) {
      await createNotification(
        String(app.mentor),
        'PROGRESS_REPORT_SUBMITTED',
        'New progress report to review',
        `${studentName} submitted progress report (Week ${input.weekNumber}) for ${oppTitle}.`,
        `/faculty/applications/${app._id}/reports`,
      );
    }

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
  // Allow COMPANY, FACULTY (if mentor), and ADMIN to give feedback
  const app = await Application.findById(doc.application).select('mentor student');
  if (!app) throw AppError.notFound('Application not found');

  const isMentor = app.mentor && String(app.mentor) === reviewerUserId;
  const isCompany = reviewerRole === 'COMPANY';
  const isAdmin = reviewerRole === 'ADMIN';

  if (!isCompany && !isMentor && !isAdmin) {
    throw AppError.forbidden('Only COMPANY, assigned mentor, or ADMIN may provide feedback');
  }

  // Notify student
  const student = await StudentProfile.findById(app.student).select('user fullName');
  if (student?.user) {
    const reviewerName = isMentor ? 'Your mentor' : isCompany ? 'The company' : 'Admin';
    await createNotification(
      String(student.user),
      'MENTOR_FEEDBACK_ADDED',
      'New feedback on your progress report',
      `${reviewerName} provided feedback on your Week ${doc.weekNumber} progress report.`,
      `/student/applications/${app._id}/reports`,
    );
  }

  doc.mentorFeedback = input.mentorFeedback;
  if (typeof input.mentorRating === 'number') doc.mentorRating = input.mentorRating;
  doc.mentorReviewedAt = new Date();
  doc.mentorReviewedBy = reviewerUserId as unknown as typeof doc.mentorReviewedBy;
  await doc.save();
  return doc.toJSON();
}
