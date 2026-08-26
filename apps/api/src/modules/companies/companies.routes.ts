import { Router } from 'express';
import { updateCompanyProfileSchema, idParamSchema } from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { uploadLogo as uploadLogoMw } from '../../middleware/upload';
import * as ctrl from './companies.controller';

const router = Router();

router.get('/me', requireAuth, requireRole('COMPANY'), ctrl.getMe);
router.get('/me/profile', requireAuth, requireRole('COMPANY'), ctrl.getMe);
router.put(
  '/me',
  requireAuth,
  requireRole('COMPANY'),
  validate(updateCompanyProfileSchema),
  ctrl.updateMe,
);
router.put(
  '/me/profile',
  requireAuth,
  requireRole('COMPANY'),
  validate(updateCompanyProfileSchema),
  ctrl.updateMe,
);
router.get('/me/dashboard', requireAuth, requireRole('COMPANY'), ctrl.dashboard);
router.post(
  '/me/logo',
  requireAuth,
  requireRole('COMPANY'),
  uploadLogoMw.single('logo'),
  ctrl.uploadLogo,
);
router.get('/', requireAuth, requireRole('ADMIN'), ctrl.list);
router.get('/:id', validate(idParamSchema, 'params'), ctrl.getById);

export default router;
