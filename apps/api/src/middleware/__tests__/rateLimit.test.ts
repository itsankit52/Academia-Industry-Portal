import { describe, expect, it } from 'vitest';
import express, { type Express, type RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Types } from 'mongoose';
import { COOKIE_NAMES } from '@aip/config';
import { createApp } from '../../app';
import { env } from '../../config/env';
import { signAccessToken } from '../../utils/jwt';
import {
  createAuthLimiter,
  createGlobalLimiter,
  createUserLimiter,
  isHealthCheck,
} from '../rateLimit';

/**
 * No database needed: the limiters answer before any handler that touches
 * Mongoose. Each test builds its own limiter so counters never leak between
 * tests. Apps mirror production: `trust proxy` 1 + cookieParser before limits.
 */

function harness(limiter: RequestHandler, mount = '/api/v1'): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(express.json());
  app.use(mount, limiter);
  app.get('/api/v1/health', (_req, res) => res.json({ success: true }));
  app.get('/api/v1/jobs', (req, res) => res.json({ success: true, ip: req.ip }));
  app.post('/api/v1/auth/login', (req, res) => {
    if (req.body?.password === 'right') return res.json({ success: true });
    return res.status(401).json({ success: false });
  });
  return app;
}

const tokenFor = (id = new Types.ObjectId().toString()) =>
  signAccessToken({ sub: id, role: 'STUDENT' });

function expect429(res: request.Response) {
  expect(res.status).toBe(429);
  expect(res.body).toEqual({
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: expect.any(String) },
  });
  expect(res.headers['ratelimit-limit']).toBeDefined();
  expect(res.headers['ratelimit-remaining']).toBe('0');
  expect(res.headers['ratelimit-reset']).toBeDefined();
  expect(res.headers['retry-after']).toBeDefined();
  // legacyHeaders: false
  expect(res.headers['x-ratelimit-limit']).toBeUndefined();
}

describe('global limiter', () => {
  const opts = { windowMs: 60_000, anonymousMax: 3, authenticatedMax: 5 };

  it('allows requests below the limit and reports remaining budget', async () => {
    const app = harness(createGlobalLimiter(opts));
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/api/v1/jobs').set('X-Forwarded-For', '198.51.100.1');
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBe('3');
      expect(res.headers['ratelimit-remaining']).toBe(String(2 - i));
    }
  });

  it('returns a consistent 429 once the limit is exceeded', async () => {
    const app = harness(createGlobalLimiter(opts));
    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/v1/jobs').set('X-Forwarded-For', '198.51.100.2').expect(200);
    }
    expect429(await request(app).get('/api/v1/jobs').set('X-Forwarded-For', '198.51.100.2'));
  });

  it('resets after the window elapses', async () => {
    const app = harness(createGlobalLimiter({ ...opts, windowMs: 300 }));
    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/v1/jobs').set('X-Forwarded-For', '198.51.100.3').expect(200);
    }
    await request(app).get('/api/v1/jobs').set('X-Forwarded-For', '198.51.100.3').expect(429);
    await new Promise((r) => setTimeout(r, 450));
    await request(app).get('/api/v1/jobs').set('X-Forwarded-For', '198.51.100.3').expect(200);
  });

  it('gives different client IPs independent budgets', async () => {
    const app = harness(createGlobalLimiter(opts));
    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/v1/jobs').set('X-Forwarded-For', '198.51.100.4').expect(200);
    }
    await request(app).get('/api/v1/jobs').set('X-Forwarded-For', '198.51.100.4').expect(429);
    await request(app).get('/api/v1/jobs').set('X-Forwarded-For', '198.51.100.5').expect(200);
  });

  it('keys by the proxy-appended address, ignoring a client-supplied X-Forwarded-For prefix', async () => {
    const app = harness(createGlobalLimiter(opts));
    // The edge proxy appends the real client (203.0.113.9) last; anything before
    // it was written by the client and must not select the bucket.
    const first = await request(app)
      .get('/api/v1/jobs')
      .set('X-Forwarded-For', '1.1.1.1, 203.0.113.9');
    expect(first.body.ip).toBe('203.0.113.9');
    await request(app)
      .get('/api/v1/jobs')
      .set('X-Forwarded-For', '2.2.2.2, 203.0.113.9')
      .expect(200);
    await request(app)
      .get('/api/v1/jobs')
      .set('X-Forwarded-For', '3.3.3.3, 203.0.113.9')
      .expect(200);
    expect429(
      await request(app).get('/api/v1/jobs').set('X-Forwarded-For', '4.4.4.4, 203.0.113.9'),
    );
  });

  it('gives signed-in users behind one NAT address their own, larger budget', async () => {
    const app = harness(createGlobalLimiter(opts));
    const nat = '192.0.2.10';
    // Anonymous traffic from the campus exhausts the per-IP budget...
    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/v1/jobs').set('X-Forwarded-For', nat).expect(200);
    }
    await request(app).get('/api/v1/jobs').set('X-Forwarded-For', nat).expect(429);

    // ...but two signed-in students on the same address are unaffected.
    const a = tokenFor();
    const b = tokenFor();
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .get('/api/v1/jobs')
        .set('X-Forwarded-For', nat)
        .set('Cookie', `${COOKIE_NAMES.ACCESS}=${a}`);
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBe('5');
    }
    expect429(
      await request(app)
        .get('/api/v1/jobs')
        .set('X-Forwarded-For', nat)
        .set('Cookie', `${COOKIE_NAMES.ACCESS}=${a}`),
    );
    await request(app)
      .get('/api/v1/jobs')
      .set('X-Forwarded-For', nat)
      .set('Authorization', `Bearer ${b}`)
      .expect(200);
  });

  it('treats a forged or invalid token as anonymous (per-IP budget)', async () => {
    const app = harness(createGlobalLimiter(opts));
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .get('/api/v1/jobs')
        .set('X-Forwarded-For', '198.51.100.6')
        .set('Authorization', `Bearer forged.${i}.token`);
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBe('3');
    }
    await request(app)
      .get('/api/v1/jobs')
      .set('X-Forwarded-For', '198.51.100.6')
      .set('Authorization', 'Bearer forged.9.token')
      .expect(429);
  });

  it('never throttles the health check', async () => {
    const app = harness(createGlobalLimiter(opts));
    for (let i = 0; i < 10; i++) {
      const res = await request(app).get('/api/v1/health').set('X-Forwarded-For', '198.51.100.7');
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBeUndefined();
    }
    // and health traffic does not consume the API budget
    await request(app).get('/api/v1/jobs').set('X-Forwarded-For', '198.51.100.7').expect(200);
  });

  it('isHealthCheck matches only GET/HEAD /health', () => {
    const r = (method: string, path: string) =>
      ({ method, path }) as Parameters<typeof isHealthCheck>[0];
    expect(isHealthCheck(r('GET', '/health'))).toBe(true);
    expect(isHealthCheck(r('HEAD', '/health/'))).toBe(true);
    expect(isHealthCheck(r('POST', '/health'))).toBe(false);
    expect(isHealthCheck(r('GET', '/healthz'))).toBe(false);
    expect(isHealthCheck(r('GET', '/jobs/health'))).toBe(false);
  });
});

describe('auth limiter', () => {
  const make = () => harness(createAuthLimiter({ windowMs: 60_000, max: 3 }), '/api/v1/auth');
  const login = (app: Express, ip: string, password: string) =>
    request(app).post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ password });

  it('blocks an IP after repeated failed attempts', async () => {
    const app = make();
    for (let i = 0; i < 3; i++) await login(app, '198.51.100.20', 'wrong').expect(401);
    const res = await login(app, '198.51.100.20', 'wrong');
    expect429(res);
    expect(res.body.error.message).toMatch(/failed authentication attempts.*1 minute/);
    // Once blocked, even the right password is refused until the window resets.
    await login(app, '198.51.100.20', 'right').expect(429);
  });

  it('does not count successful attempts', async () => {
    const app = make();
    for (let i = 0; i < 10; i++) await login(app, '198.51.100.21', 'right').expect(200);
    for (let i = 0; i < 3; i++) await login(app, '198.51.100.21', 'wrong').expect(401);
    await login(app, '198.51.100.21', 'wrong').expect(429);
  });

  it('keys by IP even when a valid session token is presented', async () => {
    const app = make();
    for (let i = 0; i < 3; i++) {
      await login(app, '198.51.100.22', 'wrong')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .expect(401);
    }
    await login(app, '198.51.100.22', 'wrong')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .expect(429);
    await login(app, '198.51.100.23', 'wrong').expect(401);
  });

  it('honours the skip option', async () => {
    const app = harness(
      createAuthLimiter({ windowMs: 60_000, max: 1, skip: () => true }),
      '/api/v1/auth',
    );
    for (let i = 0; i < 5; i++) await login(app, '198.51.100.24', 'wrong').expect(401);
  });
});

describe('per-user limiter', () => {
  it('limits each user independently regardless of IP', async () => {
    const app = express();
    app.set('trust proxy', 1);
    const limiter = createUserLimiter({
      windowMs: 60_000,
      max: 2,
      message: 'Too many AI requests',
    });
    const userA = new Types.ObjectId().toString();
    const userB = new Types.ObjectId().toString();
    app.get(
      '/x',
      (req, _res, next) => {
        req.user = { id: String(req.query.u), role: 'STUDENT' };
        next();
      },
      limiter,
      (_req, res) => res.json({ success: true }),
    );

    await request(app).get(`/x?u=${userA}`).set('X-Forwarded-For', '10.0.0.1').expect(200);
    await request(app).get(`/x?u=${userA}`).set('X-Forwarded-For', '10.0.0.2').expect(200);
    const res = await request(app).get(`/x?u=${userA}`).set('X-Forwarded-For', '10.0.0.3');
    expect429(res);
    expect(res.body.error.message).toBe('Too many AI requests');
    await request(app).get(`/x?u=${userB}`).set('X-Forwarded-For', '10.0.0.1').expect(200);
  });
});

describe('wired into the real app', () => {
  const app = createApp();

  it('applies the global policy with standard headers to API routes', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('X-Forwarded-For', '198.51.100.40');
    expect(res.status).toBe(401);
    expect(res.headers['ratelimit-limit']).toBe(String(env.RATE_LIMIT_MAX_REQUESTS));
    expect(res.headers['ratelimit-policy']).toBeDefined();
  });

  it('uses the per-user budget for signed-in callers', async () => {
    // Wrong role → 403 from requireRole, before any database access.
    const token = signAccessToken({ sub: new Types.ObjectId().toString(), role: 'COMPANY' });
    const res = await request(app)
      .get('/api/v1/assessments/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.headers['ratelimit-limit']).toBe(String(env.RATE_LIMIT_USER_MAX_REQUESTS));
  });

  it('exempts /api/v1/health', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBeUndefined();
  });

  it('caps AI requests per user', async () => {
    const token = tokenFor();
    // An empty body fails validation (422) after the limiter has counted it,
    // so no Gemini call is made.
    for (let i = 0; i < env.RATE_LIMIT_AI_MAX_REQUESTS; i++) {
      await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(422);
    }
    expect429(
      await request(app).post('/api/v1/ai/chat').set('Authorization', `Bearer ${token}`).send({}),
    );
    // A different user is unaffected.
    await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({})
      .expect(422);
  });
});
