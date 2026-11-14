import { Router } from 'express';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  googleAuthSchema,
  googleLinkSchema,
} from '@aip/validation';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { authLimiter } from '../../middleware/rateLimit';
import { requireJsonBody, requireTrustedOrigin } from '../../middleware/csrf';
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
// Linking binds a new login method to an existing account, so it is treated as
// browser-only and high-impact: exact SPA Origin required (missing is refused),
// JSON only (no HTML-form submissions), an AcadIn session, and — in the
// service — a fresh Google token plus password re-authentication.
router.post(
  '/google/link',
  requireTrustedOrigin,
  requireJsonBody,
  requireAuth,
  authLimiter,
  validate(googleLinkSchema),
  ctrl.googleLink,
);

export default router;
