import type { Skill } from './skill';

export interface TrainingProgram {
  id: string;
  title: string;
  description: string;
  provider: string;
  skills: Skill[];
  durationWeeks: number;
  startDate?: string;
  endDate?: string;
  registrationDeadline?: string;
  registrationUrl: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}
