import { Router } from 'express';
import {
  createInterimReportSchema,
  mentorFeedbackSchema,
  listInterimReportsQuerySchema,
  idParamSchema,
} from '@aip/validation';
import { z } from 'zod';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import * as ctrl from './interim-reports.controller';

const appIdParamSchema = z
  .object({ appId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') })
  .strict();

const router = Router();

router.post(
  '/applications/:appId/interim-reports',
  requireAuth,
  requireRole('STUDENT'),
  validate(appIdParamSchema, 'params'),
  validate(createInterimReportSchema),
  auditLog({
    action: 'INTERIM_REPORT_CREATE',
    entity: 'InterimReport',
    resolveEntityId: (req) => req.params.appId,
  }),
  ctrl.create,
);

router.get(
  '/applications/:appId/interim-reports',
  requireAuth,
  validate(appIdParamSchema, 'params'),
  validate(listInterimReportsQuerySchema, 'query'),
  ctrl.listForApp,
);

router.get(
  '/interim-reports/:id',
  requireAuth,
  validate(idParamSchema, 'params'),
  ctrl.getById,
);

router.patch(
  '/interim-reports/:id/feedback',
  requireAuth,
  requireRole('COMPANY', 'FACULTY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  validate(mentorFeedbackSchema),
  auditLog({
    action: 'INTERIM_REPORT_FEEDBACK',
    entity: 'InterimReport',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.feedback,
);

export default router;
