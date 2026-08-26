import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { validate } from '../../middleware/validate';
import { idParamSchema } from '@aip/validation';
import * as controller from './notifications.controller';

const router = Router();

router.use(requireAuth);

router.get('/', controller.listMine);
router.get('/unread-count', controller.unreadCount);
router.patch('/read-all', controller.markAllRead);
router.post('/read-all', controller.markAllRead);
router.patch('/:id/read', validate(idParamSchema, 'params'), controller.markRead);

export default router;
