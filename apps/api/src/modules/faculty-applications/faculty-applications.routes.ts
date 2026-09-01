/**
 * Phase 13 — Faculty-industry collaboration routes
 *
 * Mounted under the existing applications + faculty-opportunities mount
 * points so the URL structure is consistent with the rest of the API.
 *
 *   PATCH /applications/:id/withdraw
 *   GET   /applications/engagements
 *   PATCH /applications/:id/engagement/complete
 *   GET   /faculty-opportunities/:id/match-score
 *   GET   /faculty-opportunities/:id/applicants
 *
 * The withdrawal endpoint lives under /applications/* because the model
 * itself is the shared Application; engagements are faculty-only so the
 * path uses the `engagements` suffix. The remaining two follow the
 * faculty-opportunities collection since they are indexed by opportunity.
 */

import { Router } from 'express';
import {
  idParamSchema,
  objectIdSchema,
  withdrawFacultyApplicationSchema,
  createEngagementSchema,
  updateEngagementStatusSchema,
} from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import * as ctrl from './faculty-applications.controller';

const router = Router();

// --- /applications/* (Application model — shared between student and faculty)

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

// --- /faculty-opportunities/* — opportunity-scoped endpoints

const oppRouter = Router({ mergeParams: true });

// GET /faculty-opportunities/:opportunityId/match-score  — FACULTY pre-apply score
oppRouter.get(
  '/:opportunityId/match-score',
  requireAuth,
  requireRole('FACULTY'),
  validate(objectIdSchema, 'params'),
  ctrl.getMatchScore,
);

// GET /faculty-opportunities/:opportunityId/applicants — COMPANY/INSTITUTION/ADMIN
oppRouter.get(
  '/:opportunityId/applicants',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'ADMIN'),
  validate(objectIdSchema, 'params'),
  ctrl.listOpportunityApplicants,
);

// Phase 17 — Faculty engagement workflow under /faculty-opportunities/:id/engage/*

// POST /faculty-opportunities/:opportunityId/engage — FACULTY applies
oppRouter.post(
  '/:opportunityId/engage',
  requireAuth,
  requireRole('FACULTY'),
  validate(objectIdSchema, 'params'),
  validate(createEngagementSchema),
  ctrl.createEngagement,
);

// GET /faculty-opportunities/:opportunityId/engagements — host lists all engagements
oppRouter.get(
  '/:opportunityId/engagements',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'ADMIN'),
  validate(objectIdSchema, 'params'),
  ctrl.listEngagementsForOpportunity,
);

// PATCH /faculty-opportunities/:opportunityId/engage/:engagementId — host updates status
oppRouter.patch(
  '/:opportunityId/engage/:engagementId',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'ADMIN'),
  validate(objectIdSchema, 'params'),
  validate(updateEngagementStatusSchema),
  ctrl.updateEngagementStatus,
);

// Merge the opportunity-scoped router into the main router under /faculty-opportunities
router.use('/faculty-opportunities', oppRouter);

export default router;
