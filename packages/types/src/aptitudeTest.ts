import type { AptitudeCategory } from '@aip/config';
import type { AptitudeQuestionStudent } from './aptitudeQuestion';

export type AptitudeTestStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';

export interface AptitudeTestQuestionStudent {
  questionId: string;
  chosenIndex: number | null;
  question: AptitudeQuestionStudent;
}

export interface AptitudeTestQuestionResult {
  questionId: string;
  chosenIndex: number | null;
  correct: boolean | null;
  correctIndex: number;
  explanation?: string;
  question: string;
  options: string[];
}

export interface AptitudeTest {
  id: string;
  student: string;
  user: string;
  category: AptitudeCategory;
  questions: AptitudeTestQuestionStudent[];
  totalQuestions: number;
  correctCount: number;
  score: number;
  passingScore: number;
  passed: boolean;
  status: AptitudeTestStatus;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface AptitudeTestResult extends Omit<AptitudeTest, 'questions'> {
  questions: AptitudeTestQuestionResult[];
}

export interface AptitudeTestSummary {
  id: string;
  category: AptitudeCategory;
  status: AptitudeTestStatus;
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctCount: number;
  submittedAt?: string;
  createdAt: string;
}
