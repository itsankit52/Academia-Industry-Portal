import type { Skill } from './skill';

export type TrainingContentType = 'INTERNAL' | 'EXTERNAL' | 'HYBRID';
export type TrainingDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
export type TrainingLessonType = 'VIDEO' | 'ARTICLE' | 'QUIZ' | 'RESOURCE';

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
  registrationUrl?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  // Phase 15B
  contentType?: TrainingContentType;
  difficulty?: TrainingDifficulty;
  estimatedHours?: number;
  certificateAvailable?: boolean;
}

export interface TrainingModule {
  id: string;
  training: string;
  title: string;
  description?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  // Populated lessons when fetched with details
  lessons?: TrainingLesson[];
}

export interface TrainingLesson {
  id: string;
  module: string;
  training: string;
  title: string;
  description?: string;
  type: TrainingLessonType;
  content?: string;
  resourceUrl?: string;
  durationMinutes: number;
  order: number;
  quizData?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingEnrollment {
  id: string;
  student: string;
  training: string | TrainingProgram;
  status: 'ENROLLED' | 'IN_PROGRESS' | 'COMPLETED' | 'DROPPED';
  progress: number;
  enrolledAt: string;
  startedAt?: string;
  completedAt?: string;
  certificateId?: string;
  // Phase 15B
  completedLessons?: string[];
  currentLesson?: string;
  totalLessons?: number;
}
