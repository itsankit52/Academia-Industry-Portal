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
import facultyApplicationsRouter from '../modules/faculty-applications/faculty-applications.routes';
import studentOpportunitiesRouter from '../modules/student-opportunities/student-opportunities.routes';
import studentProjectsRouter from '../modules/student-projects/student-projects.routes';
import {
  studentRouter as placementReadinessRouter,
  studentOutcomesRouter as placementOutcomesRouter,
  institutionRouter as placementInstitutionRouter,
} from '../modules/placement/placement.routes';
import phase11Router from '../modules/placement/phase11.routes';
import actionQueueRouter from '../modules/placement/action-queue.routes';
import institutionReportsRouter from '../modules/placement/institution-reports.routes';

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
  // Phase 10 — Placement intelligence
  ['/placement-readiness', placementReadinessRouter],
  ['/placement-outcomes', placementOutcomesRouter],
  // Phase 10 — Institution placement analytics (nested under institution-analytics)
  ['/institution-analytics', placementInstitutionRouter],
  // Phase 11 — Placement drive operations (drives, participants, outcomes, action items)
  ['/', phase11Router],
  ['/placement-action-items', actionQueueRouter],
  ['/institution-analytics/placement-drives', institutionReportsRouter],
  ['/webhooks', webhooksRouter],
  // Phase 13 — Faculty-industry collaboration
  // - /applications/* routes: withdraw, engagement/complete, engagements
  // - /faculty-opportunities/* routes: applicants, match-score, engage, engagements
  // Both are served by facultyApplicationsRouter (merged opp sub-router).
  ['/applications', facultyApplicationsRouter],
  ['/faculty-opportunities', facultyApplicationsRouter],
  // Phase 15B — Student opportunity discovery
  ['/student-faculty-opportunities', studentOpportunitiesRouter],
  // Student-editable portfolio projects
  ['/student-projects', studentProjectsRouter],
];

for (const [path, subRouter] of mounts) {
  router.use(path, subRouter);
}

export default router;
