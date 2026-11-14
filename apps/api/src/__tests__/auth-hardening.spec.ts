/**
 * Phase 3 regressions:
 *  - ISS-04 Google-only accounts on password login / change-password (was 500)
 *  - ISS-06 no tokens or identity data in logs
 *  - ISS-07 expired Google tokens ("Token used too late") reported as expired
 *  - ISS-10 googleId never returned by the API
 *
 * Google token verification runs for real (see helpers/googleTokens).
 */
import crypto from 'node:crypto';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pino } from 'pino';
import pinoHttp from 'pino-http';
import request from 'supertest';
import { env } from '../config/env';
import { createTestApp, hasTestDb } from './helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from './helpers/db';
import { googleIdToken, useTestGoogleCerts } from './helpers/googleTokens';
import { createUserRow, parseSetCookie, TEST_PASSWORD } from './helpers/fixtures';
import { CompanyProfile, User } from '../models';
import { logger, REDACT_PATHS, serializeError } from '../utils/logger';

const API = '/api/v1/auth';
const TRUSTED_ORIGIN = new URL(env.FRONTEND_URL).origin;
const EXPIRED_MESSAGE = 'Google sign-in session has expired. Please sign in again.';

function cookiesOf(res: request.Response): string {
  const jar = parseSetCookie(res.headers['set-cookie'] as unknown as string[]);
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/** Every argument passed to the app logger, serialised, for leak assertions. */
function captureLogs(): () => string {
  const spies = (['info', 'warn', 'error', 'debug'] as const).map((level) =>
    vi.spyOn(logger, level),
  );
  return () => JSON.stringify(spies.flatMap((s) => s.mock.calls));
}

describe.skipIf(!hasTestDb)('auth hardening (Phase 3)', () => {
  const app = createTestApp();

  const googleSignup = (sub: string, claims: Record<string, unknown> = {}) =>
    request(app)
      .post(`${API}/google`)
      .send({ idToken: googleIdToken(sub, claims), role: 'COMPANY', companyName: 'Acme' });

  beforeAll(async () => {
    await connectTestDb();
    await User.syncIndexes();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
    useTestGoogleCerts();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── ISS-04 ────────────────────────────────────────────────────────────────

  // Phase 5: the password-registration rollback logs used to carry the e-mail,
  // and the error handler logged the raw error (whose message quoted it).
  it('a failed password registration logs no e-mail anywhere in the serialized output', async () => {
    const email = 'rollback.victim@example.test';
    vi.spyOn(CompanyProfile, 'create').mockRejectedValueOnce(
      Object.assign(new Error(`E11000 dup key: { contactEmail: "${email}" }`), {
        name: 'MongoServerError',
        code: 11000,
        keyValue: { contactEmail: email },
      }),
    );
    const spies = (['info', 'warn', 'error'] as const).map(
      (l) => [l, vi.spyOn(logger, l)] as const,
    );

    const res = await request(app)
      .post(`${API}/register`)
      .send({ email, password: TEST_PASSWORD, role: 'COMPANY', companyName: 'Rollback Co' });
    expect(res.status).toBe(409);
    expect(await User.countDocuments({ email })).toBe(0);

    let out = '';
    const sink = new Writable({
      write(chunk, _e, cb) {
        out += String(chunk);
        cb();
      },
    });
    const replay = pino({ serializers: { err: serializeError } }, sink);
    for (const [level, spy] of spies)
      for (const args of spy.mock.calls) (replay[level] as (...a: unknown[]) => void)(...args);

    expect(out).toContain('rolled back the user');
    expect(out).toContain('"fields":["contactEmail"]');
    expect(out).not.toContain(email);
    expect(out).not.toContain('example.test');
  });

  describe('Google-only accounts and passwords', () => {
    it('password login answers 401 exactly like an unknown email, without logging the email', async () => {
      expect((await googleSignup('g-only')).status).toBe(200);
      const logs = captureLogs();

      const googleOnly = await request(app)
        .post(`${API}/login`)
        .send({ email: 'g-only@example.test', password: 'Whatever@123' });
      const unknown = await request(app)
        .post(`${API}/login`)
        .send({ email: 'nobody@example.test', password: 'Whatever@123' });

      expect(googleOnly.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect({ code: googleOnly.body.error.code, message: googleOnly.body.error.message }).toEqual({
        code: unknown.body.error.code,
        message: unknown.body.error.message,
      });
      expect(googleOnly.headers['set-cookie']).toBeUndefined();
      expect(logs()).not.toContain('example.test');
    });

    it('change-password answers a controlled 400 and creates no password', async () => {
      const signup = await googleSignup('g-only-cp');
      const res = await request(app)
        .post(`${API}/change-password`)
        .set('Cookie', cookiesOf(signup))
        .send({ currentPassword: 'anything', newPassword: 'NewPass@1234' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe(
        'This account signs in with Google and has no password to change.',
      );
      const user = await User.findOne({ email: 'g-only-cp@example.test' }).select('+passwordHash');
      expect(user?.get('passwordHash')).toBeUndefined();
    });

    it('password accounts still log in, reject wrong passwords and change passwords', async () => {
      const row = await createUserRow('COMPANY', { email: 'pw@t.demo' });
      const wrong = await request(app)
        .post(`${API}/login`)
        .send({ email: row.email, password: 'Wrong@1234' });
      expect(wrong.status).toBe(401);

      const ok = await request(app)
        .post(`${API}/login`)
        .send({ email: row.email, password: TEST_PASSWORD });
      expect(ok.status).toBe(200);

      const change = await request(app)
        .post(`${API}/change-password`)
        .set('Cookie', cookiesOf(ok))
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'NewPass@1234' });
      expect(change.status).toBe(204);

      const relogin = await request(app)
        .post(`${API}/login`)
        .send({ email: row.email, password: 'NewPass@1234' });
      expect(relogin.status).toBe(200);
    });
  });

  // ── ISS-07 / ISS-06 ───────────────────────────────────────────────────────

  describe('Google token failures', () => {
    const now = () => Math.floor(Date.now() / 1000);
    const google = (idToken: string) => request(app).post(`${API}/google`).send({ idToken });

    it('an expired token gets the session-expired message', async () => {
      const res = await google(googleIdToken('g-exp', { iat: now() - 7200, exp: now() - 3600 }));
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe(EXPIRED_MESSAGE);
    });

    it.each([
      [
        'wrong audience',
        () => googleIdToken('g-aud', { aud: 'someone-else.apps.googleusercontent.com' }),
      ],
      [
        'invalid signature',
        () => {
          const forged = jwt.sign(
            { sub: 'x' },
            crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey,
            { algorithm: 'RS256' },
          );
          const [header, payload] = googleIdToken('g-sig').split('.');
          return `${header}.${payload}.${forged.split('.')[2]}`;
        },
      ],
      ['malformed', () => 'not-a-jwt'],
    ])('%s → 401, not the expired message', async (_label, token) => {
      const res = await google(token());
      expect(res.status).toBe(401);
      expect(res.body.error.message).not.toBe(EXPIRED_MESSAGE);
    });

    it('rejections log a reason code but never the token, email, subject or name', async () => {
      const logs = captureLogs();
      const tokens = [
        googleIdToken('g-leak-exp', { iat: now() - 7200, exp: now() - 3600 }),
        googleIdToken('g-leak-aud', { aud: 'other' }),
        `${googleIdToken('g-leak-sig').slice(0, -6)}AAAAAA`,
      ];
      for (const t of tokens) expect((await google(t)).status).toBe(401);

      const out = logs();
      expect(out).toContain('google_token_rejected');
      expect(out).toContain('"reason":"expired"');
      for (const t of tokens) expect(out).not.toContain(t.split('.')[1]);
      expect(out).not.toMatch(/g-leak|example\.test|Name g-/);
    });

    it('successful Google sign-in and signup do not log identity data', async () => {
      const logs = captureLogs();
      expect((await googleSignup('g-quiet')).status).toBe(200);
      expect((await google(googleIdToken('g-quiet'))).status).toBe(200);
      expect(logs()).not.toMatch(/g-quiet|example\.test|Name g-/);
    });
  });

  // ── ISS-10 ────────────────────────────────────────────────────────────────

  describe('googleId is never in a response', () => {
    const noGoogleId = (res: request.Response) =>
      // The key, or a Google subject as a whole JSON value (emails embed it).
      expect(JSON.stringify(res.body)).not.toMatch(/googleId|"g-resp-[a-z0-9]+"/);

    it('across signup, login, onboarding, me, refresh and link', async () => {
      const signup = await googleSignup('g-resp-1');
      expect(signup.status).toBe(200);
      noGoogleId(signup);

      const login = await request(app)
        .post(`${API}/google`)
        .send({ idToken: googleIdToken('g-resp-1') });
      expect(login.status).toBe(200);
      noGoogleId(login);

      const onboarding = await request(app)
        .post(`${API}/google`)
        .send({ idToken: googleIdToken('g-resp-new') });
      expect(onboarding.body.data.requiresOnboarding).toBe(true);
      noGoogleId(onboarding);

      const me = await request(app).get(`${API}/me`).set('Cookie', cookiesOf(login));
      expect(me.status).toBe(200);
      noGoogleId(me);

      const refresh = await request(app).post(`${API}/refresh`).set('Cookie', cookiesOf(login));
      expect(refresh.status).toBe(200);
      noGoogleId(refresh);

      const row = await createUserRow('COMPANY', { email: 'pw-link@t.demo' });
      const pwLogin = await request(app)
        .post(`${API}/login`)
        .send({ email: row.email, password: TEST_PASSWORD });
      noGoogleId(pwLogin);
      const link = await request(app)
        .post(`${API}/google/link`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookiesOf(pwLogin))
        .send({ idToken: googleIdToken('g-resp-link'), currentPassword: TEST_PASSWORD });
      expect(link.status).toBe(200);
      noGoogleId(link);
    });

    it('password registration response has no googleId', async () => {
      const res = await request(app).post(`${API}/register`).send({
        email: 'reg@t.demo',
        password: TEST_PASSWORD,
        role: 'COMPANY',
        companyName: 'Reg Co',
      });
      expect(res.status).toBe(201);
      noGoogleId(res);
    });
  });
});

// ── ISS-06: request-log redaction (no DB needed) ────────────────────────────

describe('request log redaction', () => {
  it('pino-http lines keep cookie, authorization and set-cookie values out', async () => {
    let out = '';
    const sink = new Writable({
      write(chunk, _enc, cb) {
        out += String(chunk);
        cb();
      },
    });
    const app = express();
    app.use(
      pinoHttp({ logger: pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, sink) }),
    );
    app.get('/x', (_req, res) => {
      res.cookie('aip_at', 'set-cookie-secret-value');
      res.status(401).end();
    });

    await request(app)
      .get('/x')
      .set('Cookie', 'aip_at=eyJcookie.secret.value')
      .set('Authorization', 'Bearer eyJbearer.secret.value');

    expect(out).toContain('[REDACTED]');
    expect(out).not.toMatch(/eyJcookie|eyJbearer|set-cookie-secret-value/);
  });
});
