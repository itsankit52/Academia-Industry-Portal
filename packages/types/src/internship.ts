import type { WorkMode, InternshipStatus } from '@aip/config';
import type { Skill } from './skill';

export interface Internship {
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
  durationMonths: number;
  stipend?: number;
  currency?: string;
  minCgpa?: number;
  eligibleBranches: string[];
  eligibleGradYears: number[];
  requiredSkills: Skill[];
  preferredSkills: Skill[];
  applicationDeadline?: string;
  openings: number;
  status: InternshipStatus;
  createdAt: string;
  updatedAt: string;
}
