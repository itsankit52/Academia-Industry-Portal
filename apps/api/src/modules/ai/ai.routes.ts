import { Router } from 'express';
import { chatSchema, jobMatchExplainSchema, resumeAnalyzeSchema } from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as controller from './ai.controller';

const router = Router();

router.post(
  '/resume-analyze',
  requireAuth,
  requireRole('STUDENT'),
  validate(resumeAnalyzeSchema),
  controller.analyzeResume,
);

router.post(
  '/job-match',
  requireAuth,
  requireRole('STUDENT'),
  validate(jobMatchExplainSchema),
  controller.jobMatch,
);

router.post('/chat', requireAuth, validate(chatSchema), controller.chat);

export default router;
