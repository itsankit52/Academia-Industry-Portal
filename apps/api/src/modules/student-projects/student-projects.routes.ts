import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { idParamSchema } from '@aip/validation';
import * as ctrl from './student-projects.controller';

const router = Router();

const projectLinkSchema = z
  .object({
    label: z.string().min(1).max(100).trim(),
    url: z.string().url().trim(),
  })
  .strict();

const createProjectSchema = z
  .object({
    title: z.string().min(3).max(200).trim(),
    description: z.string().min(10).max(5000).trim(),
    role: z.string().min(1).max(200).trim().optional(),
    technologies: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
    links: z.array(projectLinkSchema).max(10).optional(),
    completedAt: z.string().datetime().optional(),
  })
  .strict();

const updateProjectSchema = z
  .object({
    title: z.string().min(3).max(200).trim().optional(),
    description: z.string().min(10).max(5000).trim().optional(),
    role: z.string().min(1).max(200).trim().optional(),
    technologies: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
    links: z.array(projectLinkSchema).max(10).optional(),
    completedAt: z.string().datetime().optional().nullable(),
    isPublic: z.boolean().optional(),
  })
  .strict();

router.use(requireAuth, requireRole('STUDENT'));

router.get('/', ctrl.listMyProjects);
router.get('/:id', validate(idParamSchema, 'params'), ctrl.getProjectById);
router.post('/', validate(createProjectSchema), ctrl.createProject);
router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateProjectSchema),
  ctrl.updateProject,
);
router.delete('/:id', validate(idParamSchema, 'params'), ctrl.deleteProject);

export default router;
