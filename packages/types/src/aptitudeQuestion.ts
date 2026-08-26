import type { AptitudeCategory } from '@aip/config';

export type AptitudeDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type AptitudeQuestionStatus = 'ACTIVE' | 'ARCHIVED';

export interface AptitudeQuestion {
  id: string;
  category: AptitudeCategory;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  difficulty: AptitudeDifficulty;
  tags: string[];
  status: AptitudeQuestionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AptitudeQuestionStudent {
  id: string;
  category: AptitudeCategory;
  question: string;
  options: string[];
  difficulty: AptitudeDifficulty;
  tags: string[];
}

export interface AptitudeCategoryCount {
  category: AptitudeCategory;
  activeQuestionCount: number;
}
