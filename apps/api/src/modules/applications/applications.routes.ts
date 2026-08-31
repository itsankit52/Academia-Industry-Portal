import { Router } from 'express';
import {
  createApplicationSchema,
  updateApplicationStatusSchema,
  idParamSchema,
  assignMentorSchema,
  completeInternshipSchema,
} from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import * as ctrl from './applications.controller';

const router = Router();

router.post(
  '/',
  requireAuth,
  requireRole('STUDENT', 'FACULTY'),
  validate(createApplicationSchema),
  ctrl.create,
);
router.get('/', requireAuth, ctrl.list);
router.get(
  '/me/count-by-status',
  requireAuth,
  requireRole('STUDENT', 'FACULTY'),
  ctrl.countByStatus,
);
router.get('/:id', requireAuth, validate(idParamSchema, 'params'), ctrl.getById);
router.get(
  '/:id/candidate',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  ctrl.candidate,
);
// Phase 6A: Student offer response (STUDENT only)
router.post(
  '/:id/offer-response',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  ctrl.respondToOffer,
);
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('COMPANY', 'INSTITUTION', 'ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateApplicationStatusSchema),
  ctrl.patchStatus,
);
// Internship lifecycle endpoints (company/admin only)
router.patch(
  '/:id/internship/start',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  ctrl.startInternship,
);
router.patch(
  '/:id/internship/ongoing',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  ctrl.markInternshipOngoing,
);
router.patch(
  '/:id/internship/dates',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  ctrl.setInternshipDates,
);
// Phase 5B: completion and mentor assignment
router.patch(
  '/:id/internship/complete',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  validate(completeInternshipSchema),
  ctrl.completeInternship,
);
router.post(
  '/:id/mentor',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  validate(assignMentorSchema),
  ctrl.assignMentor,
);
router.delete(
  '/:id/mentor',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  ctrl.removeMentor,
);
router.get('/:id/mentor', requireAuth, validate(idParamSchema, 'params'), ctrl.getMentor);
// Active interns listing
router.get(
  '/company/active-interns',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  ctrl.listActiveInterns,
);
// Mentor's assigned interns
router.get(
  '/mentor/assigned-interns',
  requireAuth,
  requireRole('FACULTY', 'COMPANY', 'ADMIN'),
  ctrl.listMentorAssignedInterns,
);
router.post(
  '/:id/certificate',
  requireAuth,
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'CERTIFICATE_GENERATE',
    entity: 'Application',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.certificate,
);

// Phase 6B: Offer details, expiry, withdrawal, offer letter
router.put(
  '/:id/offer-details',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'OFFER_DETAILS_UPDATED',
    entity: 'Application',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.putOfferDetails,
);
router.post(
  '/:id/offer-letter',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'DOCUMENT_UPLOAD',
    entity: 'Application',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.attachOfferLetter,
);
router.get(
  '/:id/offer-letter',
  requireAuth,
  validate(idParamSchema, 'params'),
  ctrl.getOfferLetter,
);
router.post(
  '/:id/withdraw-offer',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'WITHDRAWAL_REQUEST',
    entity: 'Application',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.requestWithdrawal,
);

// Phase 7B: Recruitment source, placement completion, verification
router.put(
  '/:id/recruitment-source',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'RECRUITMENT_SOURCE_UPDATED',
    entity: 'Application',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.putRecruitmentSource,
);
router.patch(
  '/:id/placement-complete',
  requireAuth,
  requireRole('COMPANY', 'ADMIN'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'PLACEMENT_COMPLETED',
    entity: 'Application',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.completePlacement,
);
router.patch(
  '/:id/placement-verify',
  requireAuth,
  requireRole('INSTITUTION', 'ADMIN'),
  validate(idParamSchema, 'params'),
  auditLog({
    action: 'PLACEMENT_VERIFIED',
    entity: 'Application',
    resolveEntityId: (req) => req.params.id,
  }),
  ctrl.verifyPlacement,
);

export default router;
