import type { TrainingEnrollmentStatus } from '@aip/config';

/**
 * The full TrainingEnrollment interface (with Phase 15B lesson-tracking
 * fields) lives in `./training.ts` to keep all training-related types in
 * one module. This file re-exports the canonical interface and adds the
 * `WithDetails` view used by the API and web clients.
 */
export type {
  TrainingEnrollment,
  TrainingProgram,
  TrainingModule,
  TrainingLesson,
  TrainingContentType,
  TrainingDifficulty,
  TrainingLessonType,
} from './training';

export interface TrainingEnrollmentWithDetails {
  id: string;
  student: string;
  training: string;
  status: TrainingEnrollmentStatus;
  progress: number;
  enrolledAt: string;
  startedAt?: string;
  completedAt?: string;
  certificateId?: string;
  certificateUrl?: string;
  trainingTitle?: string;
  trainingProvider?: string;
  createdAt: string;
  updatedAt: string;
}
