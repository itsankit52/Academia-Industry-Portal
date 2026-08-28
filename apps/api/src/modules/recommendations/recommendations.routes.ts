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

export default router;
