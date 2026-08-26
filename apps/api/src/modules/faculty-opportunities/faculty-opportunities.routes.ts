import { Router } from 'express';
import {
  createFacultyOpportunitySchema,
  idParamSchema,
  listFacultyOpportunitiesQuerySchema,
  updateFacultyOpportunitySchema,
} from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import * as ctrl from './faculty-opportunities.controller';

const router = Router();

router.get('/', validate(listFacultyOpportunitiesQuerySchema, 'query'), ctrl.list);

router.get(
  '/me',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'ADMIN'),
  validate(listFacultyOpportunitiesQuerySchema, 'query'),
  ctrl.listMine,
);

router.get('/:id', validate(idParamSchema, 'params'), ctrl.getById);

router.post(
  '/',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'ADMIN'),
  validate(createFacultyOpportunitySchema),
  auditLog({
    action: 'FACULTY_OPP_CREATED',
    entity: 'FacultyOpportunity',
    resolveEntityId: (_req, res) => (res as unknown as { locals?: { entityId?: string } }).locals?.entityId,
  }),
  ctrl.create,
);

router.put(
  '/:id',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateFacultyOpportunitySchema),
  auditLog({
    action: 'FACULTY_OPP_UPDATED',
    entity: 'FacultyOpportunity',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.update,
);

router.patch(
  '/:id/close',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'ADMIN'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'FACULTY_OPP_CLOSED',
    entity: 'FacultyOpportunity',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.close,
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateFacultyOpportunitySchema),
  auditLog({
    action: 'FACULTY_OPP_UPDATED',
    entity: 'FacultyOpportunity',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.patch,
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'ADMIN'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'FACULTY_OPP_DELETED',
    entity: 'FacultyOpportunity',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.remove,
);

export default router;
