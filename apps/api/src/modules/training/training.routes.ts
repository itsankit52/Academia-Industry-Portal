import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import {
  createTrainingSchema,
  idParamSchema,
  updateTrainingSchema,
} from '@aip/validation';
import * as controller from './training.controller';

const router = Router();

router.get('/', controller.list);
router.get('/recommended/me', requireAuth, requireRole('STUDENT'), controller.recommendedForMe);
router.get('/recommended', requireAuth, requireRole('STUDENT'), controller.recommendedForMe);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate(createTrainingSchema),
  auditLog({ action: 'TRAINING_CREATED', entity: 'TrainingProgram' }),
  controller.create,
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateTrainingSchema),
  auditLog({
    action: 'TRAINING_UPDATED',
    entity: 'TrainingProgram',
    resolveEntityId: (req) => req.params.id,
  }),
  controller.update,
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'TRAINING_DELETED',
    entity: 'TrainingProgram',
    resolveEntityId: (req) => req.params.id,
  }),
  controller.remove,
);

export default router;
