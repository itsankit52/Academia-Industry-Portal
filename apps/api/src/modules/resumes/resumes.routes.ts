import { Router } from 'express';
import { idParamSchema } from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { uploadResume } from '../../middleware/upload';
import * as controller from './resumes.controller';

const router = Router();

router.use(requireAuth, requireRole('STUDENT'));

router.post('/me', uploadResume.single('resume'), controller.uploadMine);
router.get('/me', controller.getMine);
router.get('/me/history', controller.historyMine);
router.delete('/:id', validate(idParamSchema, 'params'), controller.remove);

export default router;
