import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Proficiency, SkillCategory } from '@aip/config';

export interface SkillTimelineEvent {
  id: string;
  type: 'STUDENT_SKILL_CREATED' | 'STUDENT_SKILL_UPDATED' | 'ASSESSMENT';
  at: string;
  skillId?: string;
  skillName?: string;
  fromProficiency?: Proficiency;
  toProficiency?: Proficiency;
  assessmentId?: string;
  scorePercent?: number;
  feedback?: string;
}

export interface SkillTimelineResponse {
  events: SkillTimelineEvent[];
}

export interface SkillEvidence {
  assessmentCount: number;
  assessmentAverageScore: number | null;
  resumeMentioned: boolean;
  trainingMatches: { id: string; title: string; url?: string }[];
}

export interface StudentSkillWithMeta {
  id: string;
  skill: { id: string; name: string; category: SkillCategory };
  proficiency: Proficiency;
  yearsExperience?: number;
  evidenceUrl?: string;
  evidence: SkillEvidence;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryGroup {
  category: SkillCategory;
  count: number;
  averageProficiency: number;
  skills: StudentSkillWithMeta[];
}

export interface StrengthAndGap {
  category: SkillCategory;
  skill: { id: string; name: string };
  proficiency: Proficiency;
}

export interface IndustryDemandInsight {
  topMissing: { name: string; id: string; missingCount: number }[];
  topMatched: { name: string; id: string; demandCount: number }[];
}

export interface SkillProfile {
  totals: {
    totalSkills: number;
    technicalCount: number;
    softSkillsCount: number;
    assessedSkillsCount: number;
    averageProficiency: number;
    readinessScore: number;
  };
  categories: CategoryGroup[];
  strengths: StrengthAndGap[];
  gaps: StrengthAndGap[];
  industry: IndustryDemandInsight;
  sourceBreakdown: {
    fromAssessments: number;
    fromResume: number;
    fromManual: number;
  };
}

export function useSkillProfile() {
  return useQuery({
    queryKey: ['skillProfile', 'me'] as const,
    queryFn: () => apiGet<SkillProfile>('/skills/me/profile'),
  });
}

export function useSkillTimeline() {
  return useQuery({
    queryKey: ['skillProfile', 'timeline', 'me'] as const,
    queryFn: () => apiGet<SkillTimelineResponse>('/skills/me/skill-timeline'),
  });
}
