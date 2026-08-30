/**
 * Phase 11 — Consolidated Placement Operation Routes
 *
 * Mounts participant, outcome, action-queue endpoints alongside the existing
 * placement drive CRUD routes.
 *
 * Routes:
 *   /placement-drives/:id/register
 *   /placement-drives/:id/register-bulk
 *   /placement-drives/:id/participants
 *   /placement-drives/:id/participants/:participantId
 *   /placement-drives/:id/participants/:participantId/transition
 *   /placement-drives/:id/participants/:participantId/withdraw
 *   /placement-drives/:id/outcomes
 *   /placement-drives/:id/outcomes/:outcomeId
 *   /placement-drives/:id/outcomes/:outcomeId/verify
 *   /placement-drives/:id/eligibility-preview
 *   /placement-drives/:id/eligibility-explanation
 *   /placement-drives/:id/report
 *   /placement-drives/me/participations
 *   /placement-action-items
 *   /placement-action-items/:id/acknowledge
 *   /placement-action-items/:id/start
 *   /placement-action-items/:id/resolve
 *   /placement-action-items/:id/dismiss
 *   /placement-action-items/detect
 *   /institution-analytics/placement-drives/report
 *   /institution-analytics/placement-drives/:id/eligible-students
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { participantsController } from './participants.controller';
import { outcomesController } from './outcomes.controller';
import { actionQueueController } from './action-queue.controller';

const router = Router({ mergeParams: true });

/* ── Eligibility ──────────────────────────────────────────────────────── */

router.get(
  '/:id/eligibility-preview',
  requireAuth,
  requireRole('STUDENT', 'ADMIN'),
  participantsController.eligibilityPreview,
);

router.get(
  '/:id/eligibility-explanation',
  requireAuth,
  requireRole('STUDENT', 'ADMIN'),
  participantsController.eligibilityExplanation,
);

/* ── Participation ────────────────────────────────────────────────────── */

router.get('/me/participations', requireAuth, requireRole('STUDENT'), participantsController.myParticipations);

router.post('/:id/register', requireAuth, requireRole('STUDENT', 'ADMIN'), participantsController.registerForDrive);

router.post(
  '/:id/register-bulk',
  requireAuth,
  requireRole('INSTITUTION', 'ADMIN'),
  participantsController.bulkRegister,
);

router.get('/:id/participants', requireAuth, participantsController.listParticipants);

router.get('/:id/participants/:participantId', requireAuth, participantsController.getParticipant);

router.patch(
  '/:id/participants/:participantId/transition',
  requireAuth,
  requireRole('INSTITUTION', 'ADMIN', 'COMPANY'),
  participantsController.transitionParticipant,
);

router.post(
  '/:id/participants/:participantId/withdraw',
  requireAuth,
  participantsController.withdrawParticipant,
);

/* ── Outcomes ─────────────────────────────────────────────────────────── */

router.get('/:id/outcomes', requireAuth, outcomesController.listOutcomes);

router.get('/:id/outcomes/:outcomeId', requireAuth, outcomesController.getOutcome);

router.post(
  '/:id/participants/:participantId/outcome',
  requireAuth,
  requireRole('INSTITUTION', 'ADMIN', 'COMPANY'),
  outcomesController.recordOutcome,
);

router.patch(
  '/:id/outcomes/:outcomeId',
  requireAuth,
  requireRole('INSTITUTION', 'ADMIN', 'COMPANY'),
  outcomesController.updateOutcome,
);

router.patch(
  '/:id/outcomes/:outcomeId/verify',
  requireAuth,
  requireRole('INSTITUTION', 'ADMIN'),
  outcomesController.verifyOutcome,
);

/* ── Drive Report ─────────────────────────────────────────────────────── */

router.get('/:id/report', requireAuth, requireRole('INSTITUTION', 'ADMIN'), outcomesController.getDriveReport);

export default router;
