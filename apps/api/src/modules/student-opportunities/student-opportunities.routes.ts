/**
 * Phase 15B — Student Opportunity Discovery Routes
 *
 * Student-facing endpoints for browsing, applying to, and tracking
 * faculty/institution opportunities.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import { idParamSchema } from '@aip/validation';
import * as controller from './student-opportunities.controller';

const router = Router();

router.use(requireAuth, requireRole('STUDENT'));

// List visible opportunities
router.get('/', controller.list);

// Get a single opportunity's details
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);

// Apply to an opportunity
router.post(
  '/:id/apply',
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'FACULTY_APPLICATION_CREATED',
    entity: 'FacultyOpportunity',
    resolveEntityId: (req) => req.params.id,
  }),
  controller.apply,
);

// Withdraw an application
router.post(
  '/:id/withdraw',
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'FACULTY_APPLICATION_WITHDRAWN',
    entity: 'FacultyOpportunity',
    resolveEntityId: (req) => req.params.id,
  }),
  controller.withdraw,
);

// List student's own applications
router.get('/-/my-applications', controller.listMy);

export default router;
