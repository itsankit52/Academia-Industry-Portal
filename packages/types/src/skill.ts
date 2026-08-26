import type { SkillCategory, Proficiency } from '@aip/config';

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface StudentSkill {
  id: string;
  studentId: string;
  skill: Skill;
  proficiency: Proficiency;
  yearsExperience?: number;
  evidenceUrl?: string;
  createdAt: string;
}
