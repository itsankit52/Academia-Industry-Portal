export const COOKIE_NAMES = { ACCESS: 'aip_at', REFRESH: 'aip_rt' } as const;

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 100;

export const MATCHING_WEIGHTS = { REQUIRED: 80, PREFERRED: 20 } as const;

export const MATCH_THRESHOLDS = { STRONG: 80, GOOD: 50, PARTIAL: 35 } as const;

/**
 * Weights used by the full multi-dimensional match (computeFullMatch).
 * The score for each dimension is multiplied by its weight; the eligibility
 * entry is an absolute bonus added to the final score when all criteria pass.
 * - TECHNICAL: deterministic weighted score from required + preferred skills (0-100).
 *   When split, required=60, preferred=10 (inherited from MATCHING_WEIGHTS).
 * - PROFICIENCY: how well the student's proficiency levels meet the required levels.
 * - SOFT: overlap of student soft skills vs opportunity soft skills.
 * - CAREER: overlap of student career interests vs opportunity preferredRoles/locations.
 * - INDUSTRY_DEMAND: how much of the industry's demand the student's skills cover.
 * - ELIGIBILITY: bonus added to the final score when all eligibility criteria are met.
 *
 * Sum of weights (excluding the eligibility bonus) is 0.9; the eligibility
 * bonus adds the remaining 0.1 (10 points).
 */
export const FULL_MATCH_WEIGHTS = {
  TECHNICAL: 0.5,
  PROFICIENCY: 0.1,
  SOFT: 0.1,
  CAREER: 0.1,
  INDUSTRY_DEMAND: 0.1,
  ELIGIBILITY: 10,
} as const;

export const FILE_LIMITS = {
  RESUME_MB: 5,
  LOGO_MB: 2,
  ALLOWED_RESUME_MIME: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ] as const,
  ALLOWED_IMAGE_MIME: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const,
} as const;

export const PASSWORD_MIN_LENGTH = 8;
export const BCRYPT_ROUNDS = 10;

export const DEFAULT_ASSESSMENT_QUESTIONS = 10;
export const DEFAULT_ASSESSMENT_DURATION_MIN = 30;
export const MAX_ANSWER_LENGTH = 2000;
export const MAX_ASSESSMENT_QUESTIONS = 20;
export const MIN_ASSESSMENT_QUESTIONS = 5;
export const ASSESSMENT_GENERATION_TIMEOUT_MS = 60000;
