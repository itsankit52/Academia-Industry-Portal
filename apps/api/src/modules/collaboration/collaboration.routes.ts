import { Router } from 'express';
import {
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
  registerForEventSchema,
  listMyRegistrationsQuerySchema,
  listEventRegistrationsQuerySchema,
  markAttendedSchema,
  idParamSchema,
} from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import * as ctrl from './collaboration.controller';

const router = Router();

router.get('/', validate(listEventsQuerySchema, 'query'), ctrl.list);

router.get(
  '/mine/registrations',
  requireAuth,
  validate(listMyRegistrationsQuerySchema, 'query'),
  ctrl.myRegistrations,
);

router.post(
  '/',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'FACULTY', 'ADMIN'),
  validate(createEventSchema),
  auditLog({ action: 'EVENT_CREATE', entity: 'CollaborationEvent' }),
  ctrl.create,
);

router.get('/:id', validate(idParamSchema, 'params'), ctrl.getById);

router.patch(
  '/:id',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'FACULTY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateEventSchema),
  ctrl.update,
);

router.post(
  '/:id/publish',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'FACULTY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'EVENT_PUBLISH',
    entity: 'CollaborationEvent',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.publish,
);

router.post(
  '/:id/cancel',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'FACULTY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'EVENT_CANCEL',
    entity: 'CollaborationEvent',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.cancel,
);

router.post(
  '/:id/register',
  requireAuth,
  validate(idParamSchema, 'params'),
  validate(registerForEventSchema),
  auditLog({
    action: 'EVENT_REGISTER',
    entity: 'CollaborationEvent',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.register,
);

router.delete('/:id/register', requireAuth, validate(idParamSchema, 'params'), ctrl.unregister);

router.get(
  '/:id/registrations',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'FACULTY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  validate(listEventRegistrationsQuerySchema, 'query'),
  ctrl.eventRegistrations,
);

router.post(
  '/:id/attendance',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'FACULTY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  validate(markAttendedSchema),
  ctrl.markAttended,
);

export default router;
