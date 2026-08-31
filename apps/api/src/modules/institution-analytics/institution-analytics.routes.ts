import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { idParamSchema } from '@aip/validation';
import {
  dashboardScopeSchema,
  listStudentsQuerySchema,
  listFacultyQuerySchema,
} from '@aip/validation';
import * as controller from './institution-analytics.controller';

const router = Router();

router.use(requireAuth, requireRole('INSTITUTION', 'ADMIN'));

router.get('/dashboard/stats', validate(dashboardScopeSchema, 'query'), controller.dashboardStats);
router.get(
  '/dashboard/students',
  validate(listStudentsQuerySchema, 'query'),
  controller.listStudentsHandler,
);
router.get(
  '/dashboard/faculty',
  validate(listFacultyQuerySchema, 'query'),
  controller.listFacultyHandler,
);
router.get(
  '/dashboard/skill-gaps',
  validate(dashboardScopeSchema, 'query'),
  controller.skillGapTrends,
);
router.get(
  '/dashboard/placement-metrics',
  validate(dashboardScopeSchema, 'query'),
  controller.placementMetrics,
);
router.get(
  '/dashboard/fdp-participation',
  validate(dashboardScopeSchema, 'query'),
  controller.fdpParticipation,
);
router.get(
  '/dashboard/faculty-engagements',
  validate(dashboardScopeSchema, 'query'),
  controller.facultyEngagementMetrics,
);
router.get(
  '/students/:id',
  validate(idParamSchema, 'params'),
  validate(dashboardScopeSchema, 'query'),
  controller.getStudentHandler,
);
router.get(
  '/faculty/:id',
  validate(idParamSchema, 'params'),
  validate(dashboardScopeSchema, 'query'),
  controller.getFacultyHandler,
);

export default router;
