import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import {
  createTrainingSchema,
  idParamSchema,
  updateTrainingSchema,
  enrollmentQuerySchema,
  updateProgressSchema,
  createTrainingModuleSchema,
  updateTrainingModuleSchema,
  createTrainingLessonSchema,
  updateTrainingLessonSchema,
  completeLessonSchema,
} from '@aip/validation';
import * as controller from './training.controller';
import * as enrollmentController from './trainingEnrollment.controller';
import * as contentController from './trainingContent.controller';

const router = Router();

router.get('/', controller.list);
router.get('/recommended/me', requireAuth, requireRole('STUDENT'), controller.recommendedForMe);
router.get('/recommended', requireAuth, requireRole('STUDENT'), controller.recommendedForMe);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'COMPANY', 'INSTITUTION'),
  validate(createTrainingSchema),
  auditLog({ action: 'TRAINING_CREATED', entity: 'TrainingProgram' }),
  controller.create,
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'COMPANY', 'INSTITUTION'),
  validate(idParamSchema, 'params'),
  validate(updateTrainingSchema),
  auditLog({
    action: 'TRAINING_UPDATED',
    entity: 'TrainingProgram',
    resolveEntityId: (req) => req.params.id,
  }),
  controller.update,
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'COMPANY', 'INSTITUTION'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'TRAINING_DELETED',
    entity: 'TrainingProgram',
    resolveEntityId: (req) => req.params.id,
  }),
  controller.remove,
);

// Phase 15B — Training content (modules + lessons)
router.get('/:id/content', validate(idParamSchema, 'params'), contentController.listModules);

router.post(
  '/:id/modules',
  requireAuth,
  requireRole('ADMIN', 'COMPANY', 'INSTITUTION'),
  validate(idParamSchema, 'params'),
  validate(createTrainingModuleSchema),
  contentController.createModuleHandler,
);

router.patch(
  '/:id/modules/:moduleId',
  requireAuth,
  requireRole('ADMIN', 'COMPANY', 'INSTITUTION'),
  validate(idParamSchema, 'params'),
  validate(updateTrainingModuleSchema),
  contentController.updateModuleHandler,
);

router.delete(
  '/:id/modules/:moduleId',
  requireAuth,
  requireRole('ADMIN', 'COMPANY', 'INSTITUTION'),
  validate(idParamSchema, 'params'),
  contentController.deleteModuleHandler,
);

router.post(
  '/:id/lessons',
  requireAuth,
  requireRole('ADMIN', 'COMPANY', 'INSTITUTION'),
  validate(idParamSchema, 'params'),
  validate(createTrainingLessonSchema),
  contentController.createLessonHandler,
);

router.patch(
  '/lessons/:lessonId',
  requireAuth,
  requireRole('ADMIN', 'COMPANY', 'INSTITUTION'),
  validate(idParamSchema, 'params'),
  validate(updateTrainingLessonSchema),
  contentController.updateLessonHandler,
);

router.delete(
  '/lessons/:lessonId',
  requireAuth,
  requireRole('ADMIN', 'COMPANY', 'INSTITUTION'),
  validate(idParamSchema, 'params'),
  contentController.deleteLessonHandler,
);

router.get(
  '/modules/:moduleId/lessons',
  validate(idParamSchema, 'params'),
  contentController.listLessons,
);

router.get(
  '/lessons/:lessonId',
  validate(idParamSchema, 'params'),
  contentController.getLessonHandler,
);

// Phase 15B — Student lesson completion (idempotent)
router.post(
  '/:id/lessons/complete',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  validate(completeLessonSchema),
  auditLog({
    action: 'TRAINING_PROGRESS_UPDATED',
    entity: 'TrainingLesson',
    resolveEntityId: (req) => (req.body as { lessonId?: string })?.lessonId,
  }),
  contentController.completeLessonHandler,
);

// Phase 15B — Reassess skills after training completion
router.get(
  '/enrollments/:enrollmentId/reassess',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  contentController.reassessmentHandler,
);

// Phase 8 — Training enrollment endpoints
router.post(
  '/:id/enroll',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'TRAINING_ENROLLED',
    entity: 'TrainingProgram',
    resolveEntityId: (req) => req.params.id,
  }),
  enrollmentController.enroll,
);

router.get(
  '/:id/enrollments',
  requireAuth,
  requireRole('ADMIN', 'COMPANY', 'INSTITUTION'),
  validate(idParamSchema, 'params'),
  validate(enrollmentQuerySchema, 'query'),
  enrollmentController.listTrainingEnrollments,
);

router.get(
  '/enrollments/mine',
  requireAuth,
  requireRole('STUDENT'),
  validate(enrollmentQuerySchema, 'query'),
  enrollmentController.listMine,
);

router.get(
  '/enrollments/:enrollmentId',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  enrollmentController.getMyEnrollment,
);

router.patch(
  '/enrollments/:enrollmentId/progress',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  validate(updateProgressSchema),
  auditLog({
    action: 'TRAINING_PROGRESS_UPDATED',
    entity: 'TrainingEnrollment',
    resolveEntityId: (req) => req.params.enrollmentId,
  }),
  enrollmentController.updateProgress,
);

router.post(
  '/enrollments/:enrollmentId/complete',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'TRAINING_COMPLETED',
    entity: 'TrainingEnrollment',
    resolveEntityId: (req) => req.params.enrollmentId,
  }),
  enrollmentController.complete,
);

router.delete(
  '/enrollments/:enrollmentId',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  enrollmentController.drop,
);

export default router;
