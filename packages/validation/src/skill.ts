import { z } from 'zod';
import { SKILL_CATEGORIES, PROFICIENCY_LEVELS } from '@aip/config';
import type { SkillCategory, Proficiency } from '@aip/config';
import { objectIdSchema } from './common';

const skillCategoryEnum = z.enum(SKILL_CATEGORIES as unknown as [SkillCategory, ...SkillCategory[]]);
const proficiencyEnum = z.enum(PROFICIENCY_LEVELS as unknown as [Proficiency, ...Proficiency[]]);

export const createSkillSchema = z
  .object({
    name: z.string().min(1).max(80),
    category: skillCategoryEnum,
    description: z.string().max(500).optional(),
  })
  .strict();

export const updateSkillSchema = createSkillSchema.partial();

export const addStudentSkillSchema = z
  .object({
    skillId: objectIdSchema,
    proficiency: proficiencyEnum,
    yearsExperience: z.number().min(0).max(50).optional(),
    evidenceUrl: z.string().url().optional(),
  })
  .strict();

export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
export type AddStudentSkillInput = z.infer<typeof addStudentSkillSchema>;
