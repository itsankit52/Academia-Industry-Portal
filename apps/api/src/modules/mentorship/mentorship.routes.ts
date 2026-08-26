import { Router } from 'express';
import {
  createMentorProfileSchema,
  updateMentorProfileSchema,
  listMentorsQuerySchema,
  createMentorshipRequestSchema,
  updateMentorshipRequestSchema,
  sendMessageSchema,
  listMyRequestsQuerySchema,
  listMessagesQuerySchema,
  idParamSchema,
} from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import * as ctrl from './mentorship.controller';

const router = Router();

router.get('/mentors', validate(listMentorsQuerySchema, 'query'), ctrl.listMentors);

router.post(
  '/mentors/me',
  requireAuth,
  validate(createMentorProfileSchema),
  ctrl.becomeMentor,
);
router.patch(
  '/mentors/me',
  requireAuth,
  validate(updateMentorProfileSchema),
  ctrl.updateMe,
);

router.get('/mentors/:userId', ctrl.getMentor);

router.post(
  '/requests',
  requireAuth,
  requireRole('STUDENT', 'FACULTY'),
  validate(createMentorshipRequestSchema),
  auditLog({ action: 'MENTORSHIP_REQUEST_CREATE', entity: 'MentorshipRequest' }),
  ctrl.createRequest,
);

router.get(
  '/requests/mine/as-mentee',
  requireAuth,
  validate(listMyRequestsQuerySchema, 'query'),
  ctrl.listMineAsMentee,
);
router.get(
  '/requests/mine/as-mentor',
  requireAuth,
  validate(listMyRequestsQuerySchema, 'query'),
  ctrl.listMineAsMentor,
);

router.get(
  '/requests/admin/all',
  requireAuth,
  requireRole('ADMIN'),
  ctrl.listAllAdmin,
);

router.get(
  '/requests/:id',
  requireAuth,
  validate(idParamSchema, 'params'),
  ctrl.getRequest,
);

router.patch(
  '/requests/:id/status',
  requireAuth,
  validate(idParamSchema, 'params'),
  validate(updateMentorshipRequestSchema),
  auditLog({
    action: 'MENTORSHIP_STATUS_UPDATE',
    entity: 'MentorshipRequest',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.patchRequestStatus,
);

router.get(
  '/requests/:id/messages',
  requireAuth,
  validate(idParamSchema, 'params'),
  validate(listMessagesQuerySchema, 'query'),
  ctrl.listMessages,
);
router.post(
  '/requests/:id/messages',
  requireAuth,
  validate(idParamSchema, 'params'),
  validate(sendMessageSchema),
  ctrl.postMessage,
);

export default router;
