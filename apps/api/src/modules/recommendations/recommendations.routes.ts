import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './recommendations.controller';

const router = Router();

router.use(requireAuth, requireRole('STUDENT'));

router.get('/jobs', controller.jobsForMe);
router.get('/internships', controller.internshipsForMe);
router.get('/trainings', controller.trainingsForMe);
router.get('/skills-gap', controller.skillsGap);
router.get('/learning', controller.learningForMe);
// Phase 9A — unified personalized recommendations. Defined AFTER the literal paths
// above so it never collides with /jobs, /internships, /trainings, /skills-gap.
router.get('/me', controller.personalizedForMe);
// Phase 4: full match breakdown for a single opportunity. Defined AFTER the
// literal paths above so it never collides with /jobs or /internships.
router.get('/full-match/:type/:id', controller.fullMatchForMe);
// Phase 9B: career decision support. Defined AFTER /full-match/:type/:id so the
// literal path /me/career-path doesn't collide with /me (pattern /me/*).
router.get('/me/career-path/:type/:id', controller.careerPathForMe);
router.get('/me/action-plan', controller.actionPlanForMe);
router.get('/me/benchmark', controller.benchmarkForMe);
router.get('/me/progression', controller.progressionForMe);

export default router;
