import { Router } from 'express';
import { createJobSchema, updateJobSchema, idParamSchema } from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { optionalAuth } from '../../middleware/optionalAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as ctrl from './jobs.controller';

const router = Router();

// These two stay readable without signing in, but `optionalAuth` lets a company
// open its own draft and an admin widen the status filter. Without it the
// service can only ever apply anonymous rules.
router.get('/', optionalAuth, ctrl.list);
router.get('/me/managed', requireAuth, requireRole('COMPANY'), ctrl.listManaged);
router.get('/:id', optionalAuth, validate(idParamSchema, 'params'), ctrl.getById);
router.post(
  '/',
  requireAuth,
  requireRole('COMPANY'),
  validate(createJobSchema),
  ctrl.create,
);
router.put(
  '/:id',
  requireAuth,
  requireRole('COMPANY'),
  validate(idParamSchema, 'params'),
  validate(updateJobSchema),
  ctrl.update,
);
router.patch(
  '/:id/close',
  requireAuth,
  requireRole('COMPANY'),
  validate(idParamSchema, 'params'),
  ctrl.close,
);
router.patch(
  '/:id',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateJobSchema),
  ctrl.patch,
);
router.delete(
  '/:id',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  ctrl.remove,
);

export default router;
