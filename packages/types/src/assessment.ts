import type { AssessmentStatus, SkillCategory } from '@aip/config';

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

export interface SkillBreakdown {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  score: number;
  maxScore: number;
  questionCount: number;
  answeredCount: number;
}

export interface AssessmentEvaluation {
  perQuestion: AssessmentEvaluationPerQuestion[];
  skillBreakdown: SkillBreakdown[];
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
  skillScores?: SkillBreakdown[];
}
