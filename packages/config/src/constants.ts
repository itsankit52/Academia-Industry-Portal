export const COOKIE_NAMES = { ACCESS: 'aip_at', REFRESH: 'aip_rt' } as const;

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 100;

export const MATCHING_WEIGHTS = { REQUIRED: 80, PREFERRED: 20 } as const;

export const MATCH_THRESHOLDS = { STRONG: 85, GOOD: 60, PARTIAL: 40 } as const;

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
