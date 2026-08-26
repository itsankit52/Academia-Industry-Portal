import { Router } from 'express';
import { updateFacultyProfileSchema } from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as ctrl from './faculty.controller';

const router = Router();

router.get('/me', requireAuth, requireRole('FACULTY'), ctrl.getMe);
router.get('/me/profile', requireAuth, requireRole('FACULTY'), ctrl.getMe);
router.put(
  '/me/profile',
  requireAuth,
  requireRole('FACULTY'),
  validate(updateFacultyProfileSchema),
  ctrl.updateMe,
);
router.put(
  '/me',
  requireAuth,
  requireRole('FACULTY'),
  validate(updateFacultyProfileSchema),
  ctrl.updateMe,
);

export default router;
