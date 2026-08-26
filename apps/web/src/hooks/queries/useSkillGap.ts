import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import type { OpportunityType } from '@aip/config';

export interface SkillGapInput {
  opportunityType: OpportunityType;
  opportunityId: string;
}

export interface GapSkill {
  id: string;
  name: string;
}

/**
 * Mirrors `ExplainJobMatchResult` on the API.
 *
 * Every field except `narrative` is computed from MongoDB, so the analysis is
 * complete whether or not Gemini was reachable. `aiEnhanced` says which kind of
 * narrative arrived — the UI must not present the deterministic summary as AI
 * output.
 */
export interface SkillGapResult {
  opportunityTitle: string;
  requiredSkills: GapSkill[];
  matchedSkills: GapSkill[];
  missingSkills: GapSkill[];
  preferredSkills: GapSkill[];
  preferredMatched: GapSkill[];
  studentSkillCount: number;
  matchPercentage: number;
  score: number;
  level: string;
  recommendation: string;
  narrative: string;
  aiEnhanced: boolean;
  aiUnavailableReason?: 'NOT_CONFIGURED' | 'REQUEST_FAILED';
  /** Skill names only — retained for older callers. */
  matched: string[];
  missing: string[];
}

export function useSkillGap() {
  return useMutation({
    mutationFn: (data: SkillGapInput) => apiPost<SkillGapResult>('/ai/job-match', data),
  });
}
