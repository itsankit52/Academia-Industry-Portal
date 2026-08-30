/**
 * Phase 10 — Placement Module Routes
 *
 * Conventions match existing module patterns:
 *   - /placement-readiness          → STUDENT only
 *   - /placement-outcomes           → STUDENT only
 *   - /institution-analytics/...    → INSTITUTION | ADMIN
 *
 * No studentId or institutionId is accepted from the client body — all
 * scoping is resolved server-side via existing helpers.
 *
 * Each exported router has its base path internal so the routes are
 * simply mounted as `app.use('/placement-readiness', studentRouter)`.
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './placement.controller';

/** Mounted at `/placement-readiness`. STUDENT role only. */
const studentRouter = Router();
studentRouter.use(requireAuth, requireRole('STUDENT'));
studentRouter.get('/me', controller.placementReadinessForMe);

/** Mounted at `/placement-outcomes`. STUDENT role only. */
const studentOutcomesRouter = Router();
studentOutcomesRouter.use(requireAuth, requireRole('STUDENT'));
studentOutcomesRouter.get('/me', controller.placementOutcomesForMe);

/** Mounted at `/institution-analytics`. INSTITUTION or ADMIN role. */
const institutionRouter = Router();
institutionRouter.use(requireAuth, requireRole('INSTITUTION', 'ADMIN'));
institutionRouter.get('/placement-readiness', controller.institutionPlacementReadiness);
institutionRouter.get('/interventions', controller.institutionInterventions);
institutionRouter.get('/skill-outcomes', controller.skillOutcomeAnalytics);

export { studentRouter, studentOutcomesRouter, institutionRouter };
export default studentRouter;
