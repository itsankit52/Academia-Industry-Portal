import type { MatchLevel } from '@aip/config';

export interface MatchResult {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  extraSkills: string[];
  preferredMatched: string[];
  level: MatchLevel;
  recommendation: string;
}
