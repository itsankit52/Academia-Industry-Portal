import { describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { COOKIE_NAMES } from '@aip/config';
import type { Role } from '@aip/config';
import { createApp } from '../../app';
import { signAccessToken } from '../../utils/jwt';
import { env } from '../../config/env';

/**
 * Authorization coverage that deliberately needs no database.
 *
 * Every protected route is wired as
 * `requireAuth -> requireRole(...) -> validate(...) -> handler`, so the guards
 * answer before anything touches Mongoose. That gives three observable outcomes
 * this file asserts against:
 *
 *   401  no cookie, or a cookie that does not verify
 *   403  authenticated, wrong role
 *   422  authenticated, right role, body/params rejected by `validate`
 *
 * The 422 is the interesting one: it is proof that `requireAuth` and
 * `requireRole` both let the caller through, which is what "a COMPANY user can
 * reach the company routes" actually means. The sibling suite
 * `src/__tests__/rbac.spec.ts` covers the happy paths that do need a database.
 */

const app = createApp();

const ID = new Types.ObjectId().toHexString();

/** A signed access cookie for `role`, exactly as the login endpoint would set it. */
function cookieFor(role: Role): string {
  const token = signAccessToken({ sub: new Types.ObjectId().toHexString(), role });
  return `${COOKIE_NAMES.ACCESS}=${token}`;
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** Routes a COMPANY owns and nobody else may reach. */
const COMPANY_ONLY: Array<[Method, string]> = [
  ['post', '/api/v1/jobs'],
  ['post', '/api/v1/internships'],
  ['get', '/api/v1/jobs/me/managed'],
  ['get', '/api/v1/internships/me/managed'],
  ['get', '/api/v1/companies/me'],
  ['get', '/api/v1/companies/me/profile'],
  ['get', '/api/v1/companies/me/dashboard'],
  ['put', '/api/v1/companies/me'],
];

function send(method: Method, url: string, cookie?: string) {
  const req = request(app)[method](url);
  return cookie ? req.set('Cookie', cookie) : req;
}

describe('company routes reject anonymous callers', () => {
  it.each(COMPANY_ONLY)('%s %s -> 401 without a cookie', async (method, url) => {
    const res = await send(method, url).send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a token that does not verify', async () => {
    const res = await request(app)
      .get('/api/v1/companies/me/dashboard')
      .set('Cookie', `${COOKIE_NAMES.ACCESS}=not.a.jwt`);
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    // Same shape, different key — the signature check has to be what stops this,
    // not the payload.
    const forged = jwt.sign({ sub: ID, role: 'COMPANY' }, 'a-different-secret-entirely', {
      expiresIn: '15m',
    });
    const res = await request(app)
      .get('/api/v1/companies/me/dashboard')
      .set('Cookie', `${COOKIE_NAMES.ACCESS}=${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired access token', async () => {
    // `exp` is set directly because jsonwebtoken refuses a negative `expiresIn`.
    const stale = jwt.sign(
      { sub: ID, role: 'COMPANY', exp: Math.floor(Date.now() / 1000) - 60 },
      env.JWT_ACCESS_SECRET,
    );
    const res = await request(app)
      .get('/api/v1/companies/me/dashboard')
      .set('Cookie', `${COOKIE_NAMES.ACCESS}=${stale}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('ignores a valid access token presented under the refresh cookie name', async () => {
    // The refresh cookie is scoped to /api/v1/auth and carries a different
    // payload; `requireAuth` must only ever read COOKIE_NAMES.ACCESS.
    const token = signAccessToken({ sub: ID, role: 'COMPANY' });
    const res = await request(app)
      .get('/api/v1/companies/me/dashboard')
      .set('Cookie', `${COOKIE_NAMES.REFRESH}=${token}`);
    expect(res.status).toBe(401);
  });
});

describe.each(['STUDENT', 'FACULTY', 'ADMIN'] as const)('%s cannot act as a company', (role) => {
  const cookie = cookieFor(role);

  it.each(COMPANY_ONLY)('%s %s -> 403', async (method, url) => {
    const res = await send(method, url, cookie).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('students cannot create opportunities', () => {
  it('POST /jobs with a full, valid-looking body is still refused', async () => {
    // The role check has to fire before validation, otherwise a student with a
    // well-formed body would get as far as the service.
    const res = await request(app)
      .post('/api/v1/jobs')
      .set('Cookie', cookieFor('STUDENT'))
      .send({
        title: 'Backend Engineer',
        description: 'A description long enough to satisfy the schema minimum length.',
        location: 'Bengaluru, India',
        workMode: 'HYBRID',
        employmentType: 'FULL_TIME',
        requiredSkills: [ID],
        openings: 1,
        status: 'PUBLISHED',
      });
    expect(res.status).toBe(403);
  });

  it('POST /internships is refused the same way', async () => {
    const res = await request(app)
      .post('/api/v1/internships')
      .set('Cookie', cookieFor('STUDENT'))
      .send({ title: 'Summer Intern' });
    expect(res.status).toBe(403);
  });

  it('PATCH /applications/:id/status is refused, so a student cannot shortlist', async () => {
    const res = await request(app)
      .patch(`/api/v1/applications/${ID}/status`)
      .set('Cookie', cookieFor('STUDENT'))
      .send({ status: 'SHORTLISTED' });
    expect(res.status).toBe(403);
  });

  it('POST /interviews is refused, so a student cannot schedule interviews', async () => {
    const res = await request(app)
      .post('/api/v1/interviews')
      .set('Cookie', cookieFor('STUDENT'))
      .send({ application: ID });
    expect(res.status).toBe(403);
  });
});

describe('companies cannot act as admins', () => {
  it.each([
    ['get', '/api/v1/companies'],
    ['get', '/api/v1/admin/users'],
    ['get', '/api/v1/audit-logs'],
  ] as Array<[Method, string]>)('%s %s -> 403 for COMPANY', async (method, url) => {
    const res = await send(method, url, cookieFor('COMPANY')).send({});
    expect(res.status).toBe(403);
  });

  it('DELETE /interviews/:id is ADMIN-only even for the owning company', async () => {
    const res = await request(app)
      .delete(`/api/v1/interviews/${ID}`)
      .set('Cookie', cookieFor('COMPANY'));
    expect(res.status).toBe(403);
  });
});

describe('a COMPANY token clears both guards', () => {
  const cookie = cookieFor('COMPANY');

  // 422 from `validate` means `requireAuth` and `requireRole('COMPANY')` both
  // passed. Anything else — 401 or 403 — would mean a company user is locked out
  // of its own feature, which is the bug this whole change set is about.
  it.each([
    ['post', '/api/v1/jobs'],
    ['post', '/api/v1/internships'],
    ['post', '/api/v1/interviews'],
  ] as Array<[Method, string]>)('%s %s reaches validation', async (method, url) => {
    const res = await send(method, url, cookie).send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('reaches param validation on the shortlist route', async () => {
    const res = await request(app)
      .patch('/api/v1/applications/not-an-object-id/status')
      .set('Cookie', cookie)
      .send({ status: 'SHORTLISTED' });
    expect(res.status).toBe(422);
  });

  it('accepts the same token from an Authorization header', async () => {
    const token = signAccessToken({ sub: ID, role: 'COMPANY' });
    const res = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(422);
  });
});

describe('other roles still reach their own routes', () => {
  it('a STUDENT clears the guards on POST /applications', async () => {
    const res = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', cookieFor('STUDENT'))
      .send({});
    expect(res.status).toBe(422);
  });

  it('an ADMIN clears the guards on the admin router', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/users/not-an-object-id/deactivate')
      .set('Cookie', cookieFor('ADMIN'))
      .send({});
    expect(res.status).toBe(422);
  });

  it('a COMPANY is refused by the STUDENT-only application route', async () => {
    const res = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', cookieFor('COMPANY'))
      .send({});
    expect(res.status).toBe(403);
  });
});
