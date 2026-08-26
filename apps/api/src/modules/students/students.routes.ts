import { Router } from 'express';
import { z } from 'zod';
import {
  updateStudentProfileSchema,
  idParamSchema,
  addStudentSkillSchema,
  objectIdSchema,
} from '@aip/validation';
import { OPPORTUNITY_TYPES, PROFICIENCY_LEVELS } from '@aip/config';
import type { OpportunityType, Proficiency } from '@aip/config';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as ctrl from './students.controller';
import { uploadResume } from '../../middleware/upload';

const proficiencyEnum = z.enum(
  PROFICIENCY_LEVELS as unknown as [Proficiency, ...Proficiency[]],
);

const updateStudentSkillSchema = z
  .object({
    proficiency: proficiencyEnum.optional(),
    yearsExperience: z.number().min(0).max(50).optional(),
    evidenceUrl: z.string().url().optional(),
  })
  .strict();

const opportunityTypeEnum = z.enum(
  OPPORTUNITY_TYPES as unknown as [OpportunityType, ...OpportunityType[]],
);

const saveOpportunitySchema = z
  .object({
    opportunityType: opportunityTypeEnum,
    opportunityId: objectIdSchema,
  })
  .strict();

const savedParamSchema = z
  .object({
    opportunityType: opportunityTypeEnum,
    opportunityId: objectIdSchema,
  })
  .strict();

const router = Router();

router.get('/me', requireAuth, requireRole('STUDENT'), ctrl.getMe);
router.get('/me/profile', requireAuth, requireRole('STUDENT'), ctrl.getMe);
router.put(
  '/me',
  requireAuth,
  requireRole('STUDENT'),
  validate(updateStudentProfileSchema),
  ctrl.updateMe,
);
router.put(
  '/me/profile',
  requireAuth,
  requireRole('STUDENT'),
  validate(updateStudentProfileSchema),
  ctrl.updateMe,
);
router.get('/me/summary', requireAuth, requireRole('STUDENT'), ctrl.mySummary);
router.get('/me/dashboard', requireAuth, requireRole('STUDENT'), ctrl.mySummary);

router.get('/me/skills', requireAuth, requireRole('STUDENT'), ctrl.listMySkills);
router.post(
  '/me/skills',
  requireAuth,
  requireRole('STUDENT'),
  validate(addStudentSkillSchema),
  ctrl.addMySkill,
);
router.patch(
  '/me/skills/:id',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  validate(updateStudentSkillSchema),
  ctrl.updateMySkill,
);
router.delete(
  '/me/skills/:id',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  ctrl.deleteMySkill,
);

router.get('/me/resume/download', requireAuth, requireRole('STUDENT'), ctrl.downloadMyResume);
router.get('/me/resume', requireAuth, requireRole('STUDENT'), ctrl.getMyResume);
router.post(
  '/me/resume',
  requireAuth,
  requireRole('STUDENT'),
  uploadResume.single('resume'),
  ctrl.uploadMyResume,
);
router.delete('/me/resume', requireAuth, requireRole('STUDENT'), ctrl.deleteMyResume);

router.get('/me/saved', requireAuth, requireRole('STUDENT'), ctrl.listMySaved);
router.post(
  '/me/saved',
  requireAuth,
  requireRole('STUDENT'),
  validate(saveOpportunitySchema),
  ctrl.saveOpportunity,
);
router.delete(
  '/me/saved/:opportunityType/:opportunityId',
  requireAuth,
  requireRole('STUDENT'),
  validate(savedParamSchema, 'params'),
  ctrl.unsaveOpportunity,
);

router.get('/', requireAuth, requireRole('ADMIN'), ctrl.list);
router.get(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'COMPANY'),
  validate(idParamSchema, 'params'),
  ctrl.getById,
);

export default router;
