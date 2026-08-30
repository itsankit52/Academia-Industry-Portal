/**
 * Phase 11 — Institution Reports Routes
 *
 * Mounted at /institution-analytics/placement-drives.
 *
 * Routes:
 *   GET  /institution-analytics/placement-drives/report
 *   GET  /institution-analytics/placement-drives/:id/eligible-students
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { outcomesController } from './outcomes.controller';
import { participantsController } from './participants.controller';

const router = Router();

router.get('/report', requireAuth, requireRole('INSTITUTION', 'ADMIN'), outcomesController.getInstitutionDrivesReport);
router.get('/:id/eligible-students', requireAuth, requireRole('INSTITUTION', 'ADMIN'), participantsController.eligibleStudents);

export default router;
