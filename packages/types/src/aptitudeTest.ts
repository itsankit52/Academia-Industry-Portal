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

/**
 * Phase 15C — Summary of aptitude performance across all categories.
 * Used in placement-readiness and career-analysis.
 */
export interface AptitudePerformanceSummary {
  /** Overall aptitude score: weighted average across all SUBMITTED tests (0-100). */
  overallScore: number;
  /** When insufficient aptitude data exists. */
  insufficientData: boolean;
  /** Reasons why data is insufficient. */
  insufficientReasons: string[];
  /** Per-category breakdown. */
  categories: AptitudeCategoryScore[];
  /** Total tests taken across all categories. */
  totalTestsTaken: number;
  /** Number of categories where student passed. */
  categoriesPassed: number;
  /** ISO timestamp. */
  generatedAt: string;
}

/** Per-category aptitude score. */
export interface AptitudeCategoryScore {
  category: AptitudeCategory;
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctCount: number;
  /** Number of attempts in this category. */
  attempts: number;
  /** Best score achieved in this category. */
  bestScore: number;
}
