import type { TrainingEnrollmentStatus } from '@aip/config';

export interface TrainingEnrollment {
  id: string;
  student: string;
  training: string;
  status: TrainingEnrollmentStatus;
  progress: number;
  enrolledAt: string;
  startedAt?: string;
  completedAt?: string;
  certificateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingEnrollmentWithDetails extends TrainingEnrollment {
  trainingTitle?: string;
  trainingProvider?: string;
  certificateUrl?: string;
}
