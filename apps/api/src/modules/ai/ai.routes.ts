import { Router } from 'express';
import { chatSchema, jobMatchExplainSchema, resumeAnalyzeSchema } from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { aiLimiter } from '../../middleware/rateLimit';
import * as controller from './ai.controller';

const router = Router();

// Every route here calls Gemini, so each carries a per-user budget on top of
// the global limiter. It sits after requireAuth so the key is the user id.
router.post(
  '/resume-analyze',
  requireAuth,
  requireRole('STUDENT'),
  aiLimiter,
  validate(resumeAnalyzeSchema),
  controller.analyzeResume,
);

router.post(
  '/job-match',
  requireAuth,
  requireRole('STUDENT'),
  aiLimiter,
  validate(jobMatchExplainSchema),
  controller.jobMatch,
);

router.post('/chat', requireAuth, aiLimiter, validate(chatSchema), controller.chat);

export default router;
