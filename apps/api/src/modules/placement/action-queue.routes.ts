/**
 * Phase 11 — Action Queue Routes
 *
 * Mounted at /placement-action-items.
 *
 * Routes:
 *   GET    /placement-action-items
 *   PATCH  /placement-action-items/:id/acknowledge
 *   PATCH  /placement-action-items/:id/start
 *   PATCH  /placement-action-items/:id/resolve
 *   PATCH  /placement-action-items/:id/dismiss
 *   POST   /placement-action-items/detect
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { actionQueueController } from './action-queue.controller';

const router = Router();

router.get('/', requireAuth, actionQueueController.listActionItems);
router.patch('/:id/acknowledge', requireAuth, actionQueueController.acknowledgeActionItem);
router.patch('/:id/start', requireAuth, actionQueueController.startActionItem);
router.patch('/:id/resolve', requireAuth, actionQueueController.resolveActionItem);
router.patch('/:id/dismiss', requireAuth, actionQueueController.dismissActionItem);
router.post('/detect', requireAuth, requireRole('INSTITUTION', 'ADMIN'), actionQueueController.detectActionItems);

export default router;
