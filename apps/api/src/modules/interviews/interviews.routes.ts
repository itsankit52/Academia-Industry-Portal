import { Router } from 'express';
import {
  createInterviewSchema,
  updateInterviewSchema,
  idParamSchema,
} from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as ctrl from './interviews.controller';

const router = Router();

router.post(
  '/',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(createInterviewSchema),
  ctrl.create,
);
router.get('/', requireAuth, ctrl.list);
router.get('/:id', requireAuth, validate(idParamSchema, 'params'), ctrl.getById);
router.patch(
  '/:id',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateInterviewSchema),
  ctrl.update,
);
router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate(idParamSchema, 'params'),
  ctrl.remove,
);

export default router;
