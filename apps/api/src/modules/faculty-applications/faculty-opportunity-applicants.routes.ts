/**
 * Phase 13 — Faculty-industry collaboration routes (opportunity-scoped)
 *
 *   GET   /faculty-opportunities/:opportunityId/applicants  — company / institution lists applicants
 *   GET   /faculty-opportunities/:opportunityId/match-score — faculty pre-apply match score
 *
 * Mounted under the existing /faculty-opportunities collection so a
 * company or institution looking at "their" posting can drill into the
 * faculty applicants without leaving that screen.
 */

import { Router } from 'express';
import { objectIdSchema } from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as ctrl from './faculty-applications.controller';

const router = Router();

const oppIdParamSchema = objectIdSchema;

router.get(
  '/:opportunityId/applicants',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'ADMIN'),
  validate(oppIdParamSchema, 'params'),
  ctrl.listOpportunityApplicants,
);

router.get(
  '/:opportunityId/match-score',
  requireAuth,
  requireRole('FACULTY'),
  validate(oppIdParamSchema, 'params'),
  ctrl.getMatchScore,
);

export default router;
