/**
 * Log hygiene for errors and requests (Phase 5): what reaches the log stream
 * must not contain e-mails, tokens, passwords, cookies or query values, while
 * keeping error categories, codes, field names and request ids.
 *
 * Captured logger calls are replayed through a pino instance configured with the
 * production serializers and redaction, so assertions see the serialized output.
 */
import { Writable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import mongoose from 'mongoose';
import { pino } from 'pino';
import pinoHttp from 'pino-http';
import request from 'supertest';
import { z } from 'zod';
import { User } from '../models';
import { errorHandler } from '../middleware/errorHandler';
import { serializeRequest } from '../middleware/requestLogger';
import { AppError } from '../utils/AppError';
import { logger, REDACT_PATHS, scrubText, serializeError } from '../utils/logger';

const EMAIL = 'leaky.person@example.test';
const JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
const PASSWORD = 'Hunter2-Secret!';

function sinkLogger() {
  let out = '';
  const stream = new Writable({
    write(chunk, _enc, cb) {
      out += String(chunk);
      cb();
    },
  });
  const log = pino(
    {
      serializers: { err: serializeError },
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    },
    stream,
  );
  return { log, read: () => out };
}

/** Replays every app-logger call into a production-configured pino and returns the text. */
function captureAppLogs() {
  const levels = ['info', 'warn', 'error'] as const;
  const spies = levels.map((l) => vi.spyOn(logger, l));
  return () => {
    const { log, read } = sinkLogger();
    spies.forEach((spy, i) => {
      for (const args of spy.mock.calls) (log[levels[i]!] as (...a: unknown[]) => void)(...args);
    });
    return read();
  };
}

function duplicateKeyError(): Error {
  return Object.assign(
    new Error(
      `E11000 duplicate key error collection: users index: email_1 dup key: { email: "${EMAIL}" }`,
    ),
    {
      name: 'MongoServerError',
      code: 11000,
      codeName: 'DuplicateKey',
      keyPattern: { email: 1 },
      keyValue: { email: EMAIL },
    },
  );
}

afterEach(() => vi.restoreAllMocks());

describe('serializeError', () => {
  it('duplicate key: keeps code and field names, drops the colliding value', () => {
    const out = serializeError(duplicateKeyError());
    expect(out).toMatchObject({
      type: 'MongoServerError',
      code: 11000,
      codeName: 'DuplicateKey',
      fields: ['email'],
    });
    expect(JSON.stringify(out)).not.toContain(EMAIL);
  });

  it('Mongoose ValidationError: keeps paths and kinds, drops quoted input', () => {
    const err = new User({ email: EMAIL, role: `not-a-role-${EMAIL}` }).validateSync();
    const out = serializeError(err);
    expect(out.type).toBe('ValidationError');
    expect(out.fields).toEqual(expect.arrayContaining([{ path: 'role', kind: 'enum' }]));
    expect(JSON.stringify(out)).not.toContain(EMAIL);
  });

  it('CastError: keeps path and kind, drops the value', () => {
    const err = new mongoose.Error.CastError('ObjectId', EMAIL, 'institution');
    const out = serializeError(err);
    expect(out).toMatchObject({ type: 'CastError', path: 'institution', kind: 'ObjectId' });
    expect(JSON.stringify(out)).not.toContain(EMAIL);
  });

  it('ZodError: keeps issue paths and codes only', () => {
    const parsed = z
      .object({ email: z.string().email() })
      .safeParse({ email: `${PASSWORD} ${EMAIL}x` });
    const out = serializeError(parsed.success ? null : parsed.error);
    expect(out.issues).toEqual([{ path: 'email', code: 'invalid_string' }]);
    expect(JSON.stringify(out)).not.toMatch(new RegExp(`${EMAIL}|${PASSWORD}`));
  });

  it('programming errors keep message and stack, with e-mails and JWTs masked', () => {
    const out = serializeError(new TypeError(`cannot read x of ${EMAIL} using ${JWT}`));
    expect(out.type).toBe('TypeError');
    expect(out.message).toBe('cannot read x of [email] using [jwt]');
    expect(String(out.stack)).toContain('log-safety.spec');
    expect(JSON.stringify(out)).not.toMatch(new RegExp(`${EMAIL}|eyJ`));
  });

  it('accepts the plain objects pino-http passes', () => {
    const plain = {
      type: 'MongoServerError',
      code: 11000,
      message: `dup ${EMAIL}`,
      keyValue: { email: EMAIL },
    };
    expect(JSON.stringify(serializeError(plain))).not.toContain(EMAIL);
    expect(serializeError('boom')).toEqual({ type: 'string' });
  });

  it('scrubText masks every occurrence', () => {
    expect(scrubText(`${EMAIL}, ${EMAIL.toUpperCase()} ${JWT}`)).toBe('[email], [email] [jwt]');
  });
});

describe('errorHandler logging', () => {
  function appThrowing(err: unknown) {
    const app = express();
    app.use((req, _res, next) => {
      (req as { id?: string }).id = 'req-42';
      next();
    });
    app.get('/boom', () => {
      throw err;
    });
    app.use(errorHandler);
    return app;
  }

  it.each([
    ['duplicate key', duplicateKeyError(), 409],
    ['mongoose validation', new User({ email: EMAIL, role: EMAIL }).validateSync(), 422],
    ['cast', new mongoose.Error.CastError('ObjectId', EMAIL, 'institution'), 400],
    ['app error', AppError.badRequest('Bad input'), 400],
    ['unexpected', new Error(`crashed while handling ${EMAIL}`), 500],
  ])('%s: logs code, path and request id without the value', async (_label, err, status) => {
    const logs = captureAppLogs();
    const res = await request(appThrowing(err)).get(
      `/boom?email=${encodeURIComponent(EMAIL)}&token=${JWT}`,
    );
    expect(res.status).toBe(status);

    const out = logs();
    expect(out).toContain('"requestId":"req-42"');
    expect(out).toContain('"path":"/boom"');
    expect(out).toMatch(/"code":"[A-Z_]+"/);
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain('example.test');
    expect(out).not.toContain(JWT);
  });
});

describe('request log line', () => {
  it('keeps path and query keys, drops query values, cookies and authorization', async () => {
    const { log, read } = sinkLogger();
    const app = express();
    app.use(pinoHttp({ logger: log, serializers: { req: serializeRequest, err: serializeError } }));
    app.get('/x', (_req, res) => res.status(400).end());

    await request(app)
      .get(`/x?email=${encodeURIComponent(EMAIL)}&password=${PASSWORD}`)
      .set('Cookie', `aip_at=${JWT}`)
      .set('Authorization', `Bearer ${JWT}`);

    const out = read();
    expect(out).toContain('"url":"/x"');
    expect(out).toContain('"queryKeys":["email","password"]');
    expect(out).not.toMatch(new RegExp(`${EMAIL.replace('.', '\\.')}|${PASSWORD}|${JWT}`));
    expect(out).not.toContain('leaky.person');
  });
});
