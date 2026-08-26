import type { WorkMode, EmploymentType, JobStatus } from '@aip/config';
import type { Skill } from './skill';

export interface SalaryRange {
  min: number;
  max: number;
  currency: string;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  company: {
    id: string;
    name: string;
    logoUrl?: string;
  };
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  salary?: SalaryRange;
  experienceMin?: number;
  experienceMax?: number;
  minCgpa?: number;
  eligibleBranches: string[];
  eligibleGradYears: number[];
  requiredSkills: Skill[];
  preferredSkills: Skill[];
  applicationDeadline?: string;
  openings: number;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
}
