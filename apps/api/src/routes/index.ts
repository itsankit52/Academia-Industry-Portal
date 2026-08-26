import { Router, type Router as ExpressRouter } from 'express';
import healthRouter from './health';
import authRouter from '../modules/auth/auth.routes';
import studentsRouter from '../modules/students/students.routes';
import companiesRouter from '../modules/companies/companies.routes';
import skillsRouter from '../modules/skills/skills.routes';
import jobsRouter from '../modules/jobs/jobs.routes';
import internshipsRouter from '../modules/internships/internships.routes';
import applicationsRouter from '../modules/applications/applications.routes';
import interviewsRouter from '../modules/interviews/interviews.routes';
import recommendationsRouter from '../modules/recommendations/recommendations.routes';
import notificationsRouter from '../modules/notifications/notifications.routes';
import trainingRouter from '../modules/training/training.routes';
import savedOpportunitiesRouter from '../modules/saved-opportunities/saved-opportunities.routes';
import analyticsRouter from '../modules/analytics/analytics.routes';
import resumesRouter from '../modules/resumes/resumes.routes';
import aiRouter from '../modules/ai/ai.routes';
import adminRouter from '../modules/admin/admin.routes';
import auditRouter from '../modules/audit/audit.routes';
import assessmentsRouter from '../modules/assessments/assessments.routes';
import institutionsRouter from '../modules/institutions/institutions.routes';
import facultyOpportunitiesRouter from '../modules/faculty-opportunities/faculty-opportunities.routes';
import facultyRouter from '../modules/faculty/faculty.routes';
import documentsRouter from '../modules/documents/documents.routes';
import portfolioRouter from '../modules/portfolio/portfolio.routes';
import mentorshipRouter from '../modules/mentorship/mentorship.routes';
import aptitudeRouter, { adminAptitudeRouter } from '../modules/aptitude/aptitude.routes';
import collaborationRouter from '../modules/collaboration/collaboration.routes';
import webhooksRouter from '../modules/webhooks/webhooks.routes';
import interimReportsRouter from '../modules/interim-reports/interim-reports.routes';
import institutionAnalyticsRouter from '../modules/institution-analytics/institution-analytics.routes';

const router = Router();

const mounts: Array<[string, ExpressRouter]> = [
  ['/health', healthRouter],
  ['/auth', authRouter],
  ['/students', studentsRouter],
  ['/companies', companiesRouter],
  ['/skills', skillsRouter],
  ['/jobs', jobsRouter],
  ['/internships', internshipsRouter],
  ['/applications', applicationsRouter],
  ['/interviews', interviewsRouter],
  ['/recommendations', recommendationsRouter],
  ['/notifications', notificationsRouter],
  ['/training', trainingRouter],
  ['/saved-opportunities', savedOpportunitiesRouter],
  ['/analytics', analyticsRouter],
  ['/resumes', resumesRouter],
  ['/ai', aiRouter],
  ['/admin/aptitude-questions', adminAptitudeRouter],
  ['/admin', adminRouter],
  ['/audit-logs', auditRouter],
  ['/assessments', assessmentsRouter],
  ['/institutions', institutionsRouter],
  ['/faculty-opportunities', facultyOpportunitiesRouter],
  ['/faculty', facultyRouter],
  ['/documents', documentsRouter],
  ['/portfolio', portfolioRouter],
  ['/mentorship', mentorshipRouter],
  ['/aptitude', aptitudeRouter],
  ['/events', collaborationRouter],
  ['/', interimReportsRouter],
  ['/institution', institutionAnalyticsRouter],
  ['/webhooks', webhooksRouter],
];

for (const [path, subRouter] of mounts) {
  router.use(path, subRouter);
}

export default router;
