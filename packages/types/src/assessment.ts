import type { AssessmentStatus } from '@aip/config';

export interface AssessmentQuestion {
  id: string;
  text: string;
  targetSkills: string[];
  expectedConcepts: string[];
  maxMarks: number;
}

export interface AssessmentAnswer {
  questionId: string;
  text: string;
  updatedAt: string;
}

export interface AssessmentEvaluationPerQuestion {
  questionId: string;
  score: number;
  feedback: string;
}

export interface AssessmentEvaluation {
  perQuestion: AssessmentEvaluationPerQuestion[];
  totalScore: number;
  rawScore: number;
  maxScore: number;
  overallFeedback: string;
  strengths: string;
  weaknesses: string;
  evaluatedAt: string;
}

export interface Assessment {
  id: string;
  student: string;
  status: AssessmentStatus;
  skills: string[];
  skillNames: string[];
  questions: AssessmentQuestion[];
  answers: AssessmentAnswer[];
  evaluation?: AssessmentEvaluation;
  durationMinutes: number;
  questionCount: number;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  generatedByModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentSummary {
  latestId?: string;
  latestScore?: number;
  latestStatus?: AssessmentStatus;
  latestSkills?: string[];
  latestDate?: string;
  totalCount: number;
  averageScore?: number;
}
