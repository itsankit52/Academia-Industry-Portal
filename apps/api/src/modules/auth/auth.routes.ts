import { Router } from 'express';
import { z } from 'zod';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  googleAuthSchema,
} from '@aip/validation';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { authLimiter } from '../../middleware/rateLimit';
import * as ctrl from './auth.controller';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
router.post('/logout', ctrl.logout);
router.post('/refresh', ctrl.refresh);
router.get('/me', requireAuth, ctrl.me);
router.post(
  '/change-password',
  requireAuth,
  authLimiter,
  validate(changePasswordSchema),
  ctrl.changePassword,
);

// Google OAuth endpoints — rate-limited the same as other auth actions.
router.post('/google', authLimiter, validate(googleAuthSchema), ctrl.googleAuth);
router.post(
  '/google/link',
  requireAuth,
  authLimiter,
  validate(z.object({ idToken: z.string().min(1) }).strict()),
  ctrl.googleLink,
);

export default router;
