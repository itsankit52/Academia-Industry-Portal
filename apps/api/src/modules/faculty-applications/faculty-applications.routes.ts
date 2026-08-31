/**
 * Phase 13 — Faculty-industry collaboration routes
 *
 * Mounted under the existing applications + faculty-opportunities mount
 * points so the URL structure is consistent with the rest of the API.
 *
 *   PATCH /applications/:id/withdraw
 *   GET   /applications/engagements
 *   GET   /faculty-opportunities/:id/match-score
 *   GET   /faculty-opportunities/:id/applicants
 *
 * The withdrawal endpoint lives under /applications/* because the model
 * itself is the shared Application; engagements are faculty-only so the
 * path uses the `engagements` suffix. The remaining two follow the
 * faculty-opportunities collection since they are indexed by opportunity.
 */

import { Router } from 'express';
import { idParamSchema, withdrawFacultyApplicationSchema } from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import * as ctrl from './faculty-applications.controller';

const router = Router();

router.patch(
  '/:id/withdraw',
  requireAuth,
  requireRole('FACULTY'),
  validate(idParamSchema, 'params'),
  validate(withdrawFacultyApplicationSchema),
  auditLog({
    action: 'FACULTY_APPLICATION_WITHDRAWN',
    entity: 'Application',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.withdraw,
);

router.patch(
  '/:id/engagement/complete',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'ADMIN'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'FACULTY_ENGAGEMENT_COMPLETED',
    entity: 'Application',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.completeEngagement,
);

router.get('/engagements', requireAuth, requireRole('FACULTY'), ctrl.listEngagements);

export default router;
