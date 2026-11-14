import { Router } from 'express';
import {
  generateAssessmentSchema,
  idParamSchema,
  paginationQuerySchema,
  saveAnswerSchema,
} from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { createUserLimiter } from '../../middleware/rateLimit';
import * as ctrl from './assessments.controller';

// Per student (it runs after requireAuth), not per IP: keyed by IP, a whole
// campus behind one NAT address shared five generations an hour.
const generateLimiter = createUserLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many assessment generations, try again in an hour',
});

const router = Router();

router.get(
  '/me',
  requireAuth,
  requireRole('STUDENT'),
  validate(paginationQuerySchema, 'query'),
  ctrl.listMyAssessments,
);

router.get('/me/latest', requireAuth, requireRole('STUDENT'), ctrl.getMyLatest);

router.get('/me/summary', requireAuth, requireRole('STUDENT'), ctrl.getAssessmentSummary);

router.post(
  '/me/generate',
  requireAuth,
  requireRole('STUDENT'),
  generateLimiter,
  validate(generateAssessmentSchema),
  ctrl.generateAssessment,
);

router.get(
  '/:id',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  ctrl.getById,
);

router.patch(
  '/:id/answers',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  validate(saveAnswerSchema),
  ctrl.saveAnswer,
);

router.post(
  '/:id/submit',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  ctrl.submitAssessment,
);

export default router;
