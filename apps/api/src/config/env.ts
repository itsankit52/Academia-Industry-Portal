import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { RECOMMENDED_GEMINI_MODEL, isRetiredGeminiModel, resolveGeminiModel } from './geminiModels';

loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Blank means "send a host-only cookie" — see the comment in utils/cookies.ts.
  // It is not defaulted to `localhost` any more: that value is only ever correct
  // on a developer machine, and a deployed API that inherited it would emit a
  // cookie the browser rejects outright.
  COOKIE_DOMAIN: z.string().default(''),
  COOKIE_SECURE: z
    .union([z.string(), z.boolean()])
    .transform((v) => (typeof v === 'boolean' ? v : v.toLowerCase() === 'true'))
    .default(false),
  // `lax` is right whenever the SPA and the API share a registrable domain, and
  // it stays the default so local development is untouched. It is wrong when
  // they do not — two different *.onrender.com hosts are cross-site, because
  // onrender.com is a public suffix — and a Lax cookie is then simply never
  // attached to the SPA's requests, so every call after login returns 401.
  // Blank is treated as unset rather than as an error, matching resolveGeminiModel.
  COOKIE_SAMESITE: z
    .string()
    .transform((v) => {
      const normalized = v.trim().toLowerCase();
      return normalized.length > 0 ? normalized : 'lax';
    })
    .pipe(z.enum(['lax', 'strict', 'none']))
    .default('lax'),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),

  GEMINI_API_KEY: z.string().optional().default(''),
  // Not a plain `.default()`: an empty `GEMINI_MODEL=` line parses as '' and
  // would be passed through verbatim. See `resolveGeminiModel`.
  GEMINI_MODEL: z
    .string()
    .optional()
    .transform((value) => resolveGeminiModel(value)),

  WEBHOOK_LMS_SECRET: z.string().optional().default(''),
  WEBHOOK_ERP_SECRET: z.string().optional().default(''),

  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(5),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`[env] Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

// Only worth saying when a key is actually present — with no key the AI paths are
// skipped deliberately and the model id is irrelevant.
if (env.GEMINI_API_KEY && isRetiredGeminiModel(env.GEMINI_MODEL)) {
  // eslint-disable-next-line no-console
  console.warn(
    `[env] GEMINI_MODEL="${env.GEMINI_MODEL}" has been retired by Google. ` +
      `Gemini requests will fail and every AI feature will silently serve its ` +
      `deterministic fallback instead. Set GEMINI_MODEL=${RECOMMENDED_GEMINI_MODEL} ` +
      `(see docs/CHANGING_AI_MODEL.md).`,
  );
}
