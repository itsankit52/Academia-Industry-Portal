export { computeMatch, scoreMatch, type MatchCounts, type MatchScore } from './algorithm';
export {
  analyzeSkillGap,
  computeSkillGap,
  loadOpportunitySkills,
  loadStudentSkillIds,
  type GapSkill,
  type RawSkill,
  type SkillGapAnalysis,
  type SkillGapMath,
} from './skillGap';
export {
  computeFullMatch,
  checkEligibility,
  scoreSoftSkills,
  scoreCareerInterests,
  scoreProficiencyGaps,
  type FullMatchInput,
  type FullMatchEligibilityInput,
  type FullMatchTechnicalSkill,
  type FullMatchSoftSkill,
  type SoftSkillMatchResult,
  type FullMatchResult,
  type IndustryDemandSignal,
} from './fullMatch';
