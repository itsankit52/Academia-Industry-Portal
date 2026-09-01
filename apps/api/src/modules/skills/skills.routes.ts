import { Router } from 'express';
import { z } from 'zod';
import { PROFICIENCY_LEVELS } from '@aip/config';
import type { Proficiency } from '@aip/config';
import {
  createSkillSchema,
  updateSkillSchema,
  addStudentSkillSchema,
  idParamSchema,
} from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as ctrl from './skills.controller';
import * as evidenceCtrl from './skillEvidence.controller';

const router = Router();

const proficiencyEnum = z.enum(PROFICIENCY_LEVELS as unknown as [Proficiency, ...Proficiency[]]);

const updateStudentSkillSchema = z
  .object({
    proficiency: proficiencyEnum.optional(),
    yearsExperience: z.number().min(0).max(50).optional(),
    evidenceUrl: z.string().url().optional(),
  })
  .strict();

const studentIdParamSchema = z
  .object({ studentId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') })
  .strict();

router.get('/', ctrl.list);
// Any authenticated user may suggest a new skill — useful when building a job
// posting, a training programme, or a student profile and the catalogue is
// missing something the user actually needs. ADMIN keeps exclusive control of
// update and archive so the catalogue doesn't drift without oversight.
router.post('/', requireAuth, validate(createSkillSchema), ctrl.create);
router.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateSkillSchema),
  ctrl.update,
);
router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate(idParamSchema, 'params'),
  ctrl.remove,
);

router.get('/me/student-skills', requireAuth, requireRole('STUDENT'), ctrl.listMyStudentSkills);
router.get('/me/profile', requireAuth, requireRole('STUDENT'), ctrl.getMyProfile);
router.get('/me/skill-timeline', requireAuth, requireRole('STUDENT'), ctrl.getMySkillTimeline);
router.get(
  '/me/skill-evidence',
  requireAuth,
  requireRole('STUDENT'),
  evidenceCtrl.getMySkillEvidence,
);
router.get(
  '/me/skills-to-reassess',
  requireAuth,
  requireRole('STUDENT'),
  evidenceCtrl.getSkillsToReassess,
);
router.post(
  '/me/skills-from-resume',
  requireAuth,
  requireRole('STUDENT'),
  ctrl.addSkillsFromResume,
);
router.post(
  '/me/student-skills',
  requireAuth,
  requireRole('STUDENT'),
  validate(addStudentSkillSchema),
  ctrl.addMyStudentSkill,
);
router.patch(
  '/me/student-skills/:id',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  validate(updateStudentSkillSchema),
  ctrl.updateMyStudentSkill,
);
router.delete(
  '/me/student-skills/:id',
  requireAuth,
  requireRole('STUDENT'),
  validate(idParamSchema, 'params'),
  ctrl.deleteMyStudentSkill,
);

router.get(
  '/students/:studentId/skills',
  requireAuth,
  requireRole('ADMIN', 'COMPANY'),
  validate(studentIdParamSchema, 'params'),
  ctrl.listForStudent,
);

export default router;
