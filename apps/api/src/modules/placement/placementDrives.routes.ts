/**
 * Phase 11 — Placement Drive Routes
 *
 * Conventions:
 *   - /placement-drives              → Drive CRUD
 *   - /placement-drives/:id/:verb   → Lifecycle transitions
 *   - Authorization: INSTITUTION/ADMIN for writes, all roles for reads
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { placementDrivesController as ctrl } from './placementDrives.controller';

const router = Router({ mergeParams: true });

/** Public read — all authenticated users can list/view drives */
router.use(requireAuth);

/** POST /placement-drives — create drive */
router.post('/', requireRole('INSTITUTION', 'ADMIN'), ctrl.createDrive);

/** GET /placement-drives — list drives */
router.get('/', ctrl.listDrives);

/** GET /placement-drives/:id — get drive detail */
router.get('/:id', ctrl.getDrive);

/** PATCH /placement-drives/:id — update drive */
router.patch('/:id', requireRole('INSTITUTION', 'ADMIN'), ctrl.updateDrive);

/** DELETE /placement-drives/:id — archive drive */
router.delete('/:id', requireRole('INSTITUTION', 'ADMIN'), ctrl.archiveDrive);

/** POST /placement-drives/:id/duplicate */
router.post('/:id/duplicate', requireRole('INSTITUTION', 'ADMIN'), ctrl.duplicateDrive);

/** GET /placement-drives/:id/counts — participant counts */
router.get('/:id/counts', ctrl.getDriveCounts);

/** Lifecycle transition routes */
router.post('/:id/transition', requireRole('INSTITUTION', 'ADMIN'), ctrl.transitionDrive);

export default router;
