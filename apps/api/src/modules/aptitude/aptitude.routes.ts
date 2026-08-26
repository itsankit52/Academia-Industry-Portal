import { Router } from 'express';
import {
  createAptitudeQuestionSchema,
  idParamSchema,
  listAptitudeQuestionsQuerySchema,
  listMyAptitudeTestsQuerySchema,
  saveAptitudeAnswerSchema,
  startAptitudeTestSchema,
  updateAptitudeQuestionSchema,
} from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import * as ctrl from './aptitude.controller';

const router = Router();

router.get(
  '/categories',
  requireAuth,
  requireRole('STUDENT', 'FACULTY', 'ADMIN'),
  ctrl.listCategories,
);

router.post(
  '/tests',
  requireAuth,
  requireRole('STUDENT'),
  validate(startAptitudeTestSchema),
  auditLog({ action: 'APTITUDE_TEST_START', entity: 'AptitudeTest' }),
  ctrl.startTest,
);

router.get(
  '/tests/me',
  requireAuth,
  requireRole('STUDENT'),
  validate(listMyAptitudeTestsQuerySchema, 'query'),
  ctrl.listMyTests,
);

router.get(
  '/tests/:id',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  ctrl.getMyTest,
);

router.patch(
  '/tests/:id/answers',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  validate(saveAptitudeAnswerSchema),
  ctrl.saveAnswer,
);

router.post(
  '/tests/:id/submit',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'APTITUDE_TEST_SUBMIT',
    entity: 'AptitudeTest',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.submitTest,
);

export const adminAptitudeRouter = Router();

adminAptitudeRouter.use(requireAuth, requireRole('ADMIN'));

adminAptitudeRouter.get(
  '/',
  validate(listAptitudeQuestionsQuerySchema, 'query'),
  ctrl.listQuestions,
);

adminAptitudeRouter.post(
  '/',
  validate(createAptitudeQuestionSchema),
  auditLog({ action: 'APTITUDE_QUESTION_CREATE', entity: 'AptitudeQuestion' }),
  ctrl.createQuestion,
);

adminAptitudeRouter.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateAptitudeQuestionSchema),
  auditLog({
    action: 'APTITUDE_QUESTION_UPDATE',
    entity: 'AptitudeQuestion',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.updateQuestion,
);

adminAptitudeRouter.post(
  '/:id/archive',
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'APTITUDE_QUESTION_ARCHIVE',
    entity: 'AptitudeQuestion',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.archiveQuestion,
);

export default router;
