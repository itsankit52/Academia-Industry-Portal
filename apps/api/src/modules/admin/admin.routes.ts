import { Router } from 'express';
import { z } from 'zod';
import {
  createInstitutionSchema,
  updateInstitutionSchema,
  listInstitutionsQuerySchema,
  inviteInstitutionUserSchema,
  idParamSchema,
} from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import * as controller from './admin.controller';
import * as institutionsController from './institutions.controller';

const patchUserSchema = z.object({ isActive: z.boolean() }).strict();

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/users', controller.users);

router.patch(
  '/users/:id/deactivate',
  validate(idParamSchema, 'params'),
  auditLog({ action: 'USER_DEACTIVATED', entity: 'User', resolveEntityId: (req) => req.params.id }),
  controller.deactivate,
);
router.post(
  '/users/:id/deactivate',
  validate(idParamSchema, 'params'),
  auditLog({ action: 'USER_DEACTIVATED', entity: 'User', resolveEntityId: (req) => req.params.id }),
  controller.deactivate,
);

router.patch(
  '/users/:id/activate',
  validate(idParamSchema, 'params'),
  auditLog({ action: 'USER_UPDATED', entity: 'User', resolveEntityId: (req) => req.params.id }),
  controller.activate,
);
router.post(
  '/users/:id/activate',
  validate(idParamSchema, 'params'),
  auditLog({ action: 'USER_UPDATED', entity: 'User', resolveEntityId: (req) => req.params.id }),
  controller.activate,
);

router.patch(
  '/users/:id',
  validate(idParamSchema, 'params'),
  validate(patchUserSchema),
  auditLog({ action: 'USER_UPDATED', entity: 'User', resolveEntityId: (req) => req.params.id }),
  controller.patchUser,
);

router.delete(
  '/users/:id',
  validate(idParamSchema, 'params'),
  auditLog({ action: 'USER_DEACTIVATED', entity: 'User', resolveEntityId: (req) => req.params.id }),
  controller.removeUser,
);

router.patch(
  '/companies/:id/verify',
  validate(idParamSchema, 'params'),
  auditLog({ action: 'USER_UPDATED', entity: 'CompanyProfile', resolveEntityId: (req) => req.params.id }),
  controller.verifyCompanyProfile,
);
router.post(
  '/companies/:id/verify',
  validate(idParamSchema, 'params'),
  auditLog({ action: 'USER_UPDATED', entity: 'CompanyProfile', resolveEntityId: (req) => req.params.id }),
  controller.verifyCompanyProfile,
);

router.patch(
  '/jobs/:id/force-close',
  validate(idParamSchema, 'params'),
  auditLog({ action: 'JOB_CLOSED', entity: 'Job', resolveEntityId: (req) => req.params.id }),
  controller.closeJob,
);
router.post(
  '/jobs/:id/force-close',
  validate(idParamSchema, 'params'),
  auditLog({ action: 'JOB_CLOSED', entity: 'Job', resolveEntityId: (req) => req.params.id }),
  controller.closeJob,
);

router.patch(
  '/internships/:id/force-close',
  validate(idParamSchema, 'params'),
  auditLog({ action: 'INTERNSHIP_CLOSED', entity: 'Internship', resolveEntityId: (req) => req.params.id }),
  controller.closeInternship,
);
router.post(
  '/internships/:id/force-close',
  validate(idParamSchema, 'params'),
  auditLog({ action: 'INTERNSHIP_CLOSED', entity: 'Internship', resolveEntityId: (req) => req.params.id }),
  controller.closeInternship,
);

router.get(
  '/institutions',
  validate(listInstitutionsQuerySchema, 'query'),
  institutionsController.list,
);
router.post(
  '/institutions',
  validate(createInstitutionSchema),
  auditLog({ action: 'INSTITUTION_CREATED', entity: 'Institution' }),
  institutionsController.create,
);
router.patch(
  '/institutions/:id',
  validate(idParamSchema, 'params'),
  validate(updateInstitutionSchema),
  auditLog({
    action: 'INSTITUTION_UPDATED',
    entity: 'Institution',
    resolveEntityId: (req) => req.params.id,
  }),
  institutionsController.update,
);
router.post(
  '/institutions/:id/verify',
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'INSTITUTION_VERIFIED',
    entity: 'Institution',
    resolveEntityId: (req) => req.params.id,
  }),
  institutionsController.verify,
);
router.post(
  '/institutions/:id/invite-user',
  validate(idParamSchema, 'params'),
  validate(inviteInstitutionUserSchema),
  auditLog({
    action: 'INSTITUTION_USER_INVITED',
    entity: 'Institution',
    resolveEntityId: (req) => req.params.id,
  }),
  institutionsController.inviteUser,
);

export default router;
