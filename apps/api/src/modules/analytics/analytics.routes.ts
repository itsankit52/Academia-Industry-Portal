import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './analytics.controller';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/dashboard', controller.dashboard);
router.get('/applications-over-time', controller.applicationsOverTime);
router.get('/placements-over-time', controller.placementsOverTime);
router.get('/jobs-by-category', controller.jobsByCategory);
router.get('/internships-by-category', controller.internshipsByCategory);
router.get('/students-by-branch', controller.studentsByBranch);
router.get('/industry-skill-demand', controller.industrySkillDemand);
router.get('/company-participation', controller.companyParticipation);

export default router;
