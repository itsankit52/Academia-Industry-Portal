import { Router } from 'express';
import { idParamSchema } from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as controller from './audit.controller';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/', controller.list);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);

export default router;
