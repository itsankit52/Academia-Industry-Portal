import { pino, type Logger } from 'pino';
import { env } from '../config/env';

const isDev = env.NODE_ENV !== 'production';

/**
 * Credentials that pino-http would otherwise copy into every request log line:
 * the auth cookies (access/refresh JWTs), bearer tokens and the cookies the
 * API sets on login. Exported so the redaction can be tested.
 */
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT_RE = /\beyJ[\w-]+\.[\w-]+\.[\w-]*/g;

/** Masks e-mail addresses and JWTs in free text (messages, stack traces). */
export function scrubText(text: string): string {
  return text.replace(JWT_RE, '[jwt]').replace(EMAIL_RE, '[email]');
}

/** A stack trace without its first line, which repeats the (data-bearing) message. */
function framesOnly(stack: unknown): string | undefined {
  return typeof stack === 'string' ? stack.split('\n').slice(1).join('\n') : undefined;
}

type ErrorLike = {
  name?: unknown;
  type?: unknown;
  message?: unknown;
  stack?: unknown;
  code?: unknown;
  codeName?: unknown;
  statusCode?: unknown;
  keyPattern?: unknown;
  keyValue?: unknown;
  errors?: unknown;
  issues?: unknown;
  path?: unknown;
  kind?: unknown;
};

/**
 * Log-safe view of an error, used as pino's `err` serializer so every
 * `logger.x({ err }, …)` in the codebase goes through it.
 *
 * Database and validation errors carry the offending *values* — a duplicate-key
 * error's `keyValue`/message holds the e-mail that collided, a Mongoose
 * ValidationError or CastError message quotes the input. Those keep only their
 * category, codes and field names. Other errors (programming faults) keep
 * message and stack for debugging, with e-mails and JWTs masked.
 *
 * Accepts real Errors and the plain objects pino-http's wrapped serializers pass.
 */
export function serializeError(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== 'object') return { type: typeof err };
  const e = err as ErrorLike;
  const type = String(e.name ?? e.type ?? 'Error');
  const out: Record<string, unknown> = { type };
  if (typeof e.code === 'string' || typeof e.code === 'number') out.code = e.code;

  if (/^Mongo(Server|BulkWrite|WriteConcern)Error$/.test(type) || e.code === 11000) {
    if (typeof e.codeName === 'string') out.codeName = e.codeName;
    const keys = e.keyPattern ?? e.keyValue;
    if (keys && typeof keys === 'object') out.fields = Object.keys(keys);
    out.stack = framesOnly(e.stack);
    return out;
  }
  if (type === 'ZodError' && Array.isArray(e.issues)) {
    out.issues = (e.issues as Array<{ path?: unknown[]; code?: unknown }>).map((i) => ({
      path: (i.path ?? []).join('.'),
      code: i.code,
    }));
    return out;
  }
  if (type === 'ValidationError' && e.errors && typeof e.errors === 'object') {
    out.fields = Object.entries(e.errors as Record<string, { kind?: unknown }>).map(
      ([path, v]) => ({ path, kind: v?.kind }),
    );
    out.stack = framesOnly(e.stack);
    return out;
  }
  if (type === 'CastError') {
    out.path = e.path;
    out.kind = e.kind;
    out.stack = framesOnly(e.stack);
    return out;
  }

  if (typeof e.statusCode === 'number') out.statusCode = e.statusCode;
  if (typeof e.message === 'string') out.message = scrubText(e.message);
  if (typeof e.stack === 'string') out.stack = scrubText(e.stack);
  return out;
}

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: undefined,
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  serializers: { err: serializeError },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});
