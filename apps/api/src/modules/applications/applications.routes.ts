import { Router } from 'express';
import {
  createApplicationSchema,
  updateApplicationStatusSchema,
  idParamSchema,
} from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import * as ctrl from './applications.controller';

const router = Router();

router.post(
  '/',
  requireAuth,
  requireRole('STUDENT', 'FACULTY'),
  validate(createApplicationSchema),
  ctrl.create,
);
router.get('/', requireAuth, ctrl.list);
router.get(
  '/me/count-by-status',
  requireAuth,
  requireRole('STUDENT', 'FACULTY'),
  ctrl.countByStatus,
);
router.get('/:id', requireAuth, validate(idParamSchema, 'params'), ctrl.getById);
router.get(
  '/:id/candidate',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  ctrl.candidate,
);
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateApplicationStatusSchema),
  ctrl.patchStatus,
);
router.post(
  '/:id/certificate',
  requireAuth,
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'CERTIFICATE_GENERATE',
    entity: 'Application',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.certificate,
);

export default router;
