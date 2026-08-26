import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { COOKIE_NAMES } from '@aip/config';
import { createTestApp, hasTestDb } from './helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from './helpers/db';
import { CompanyProfile, User } from '../models';
import {
  TEST_PASSWORD,
  createUserAndLogin,
  createUserRow,
  ensureTestInstitution,
  parseSetCookie,
} from './helpers/fixtures';

describe.skipIf(!hasTestDb)('auth', () => {
  const app = createTestApp();

  beforeAll(async () => {
    await connectTestDb();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  it('POST /register creates a STUDENT and sets auth cookies', async () => {
    const institutionId = await ensureTestInstitution();
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'reg-student@t.demo',
      password: TEST_PASSWORD,
      role: 'STUDENT',
      fullName: 'Register Student',
      institutionId,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('reg-student@t.demo');
    expect(res.body.data.user.role).toBe('STUDENT');
    const cookies = parseSetCookie(res.headers['set-cookie'] as string[] | undefined);
    expect(cookies[COOKIE_NAMES.ACCESS]).toBeTruthy();
    expect(cookies[COOKIE_NAMES.REFRESH]).toBeTruthy();
  });

  it('POST /register creates a COMPANY together with its CompanyProfile', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'reg-company@t.demo',
      password: TEST_PASSWORD,
      role: 'COMPANY',
      companyName: 'Register Company',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('COMPANY');

    // A COMPANY User on its own is not a usable account. Every company route
    // resolves the acting company through CompanyProfile.findOne({ user }), so a
    // signup that creates only the User produces someone who can log in and then
    // gets "Company profile not found" from every single company feature — and
    // cannot re-register, because the email is now taken.
    const user = await User.findOne({ email: 'reg-company@t.demo' });
    expect(user).not.toBeNull();
    const profile = await CompanyProfile.findOne({ user: user!._id });
    expect(profile).not.toBeNull();
    expect(profile!.companyName).toBe('Register Company');
    expect(String(profile!.user)).toBe(String(user!._id));
  });

  it('a freshly registered COMPANY can immediately use the company routes', async () => {
    const signup = await request(app).post('/api/v1/auth/register').send({
      email: 'reg-company-flow@t.demo',
      password: TEST_PASSWORD,
      role: 'COMPANY',
      companyName: 'Flow Company',
    });
    expect(signup.status).toBe(201);
    const cookie = (signup.headers['set-cookie'] as string[] | undefined)
      ?.map((c) => c.split(';')[0])
      .join('; ');
    expect(cookie).toBeTruthy();

    // /auth/me has to hand the client its company profile, because that is what
    // the dashboard and the opportunity forms key off.
    const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookie!);
    expect(me.status).toBe(200);
    expect(me.body.data.user.role).toBe('COMPANY');
    expect(me.body.data.companyProfile).not.toBeNull();
    expect(me.body.data.companyProfile.companyName).toBe('Flow Company');

    // And the company-scoped endpoints must resolve the same profile rather than
    // 404ing on a missing one.
    const profile = await request(app).get('/api/v1/companies/me').set('Cookie', cookie!);
    expect(profile.status).toBe(200);

    const dashboard = await request(app)
      .get('/api/v1/companies/me/dashboard')
      .set('Cookie', cookie!);
    expect(dashboard.status).toBe(200);

    const managed = await request(app).get('/api/v1/jobs/me/managed').set('Cookie', cookie!);
    expect(managed.status).toBe(200);
  });

  it('POST /register creates nothing at all when the company name is missing', async () => {
    // The schema refine catches this before the service runs, which is the point:
    // the request that cannot produce a CompanyProfile must not produce a User
    // either, or the email is burned on an account that can never reach a company
    // route. (The service-level rollback for a profile write that fails *after*
    // the User is created is covered by modules/auth/__tests__/auth.service.test.ts.)
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'reg-company-orphan@t.demo',
      password: TEST_PASSWORD,
      role: 'COMPANY',
    });
    expect(res.status).toBe(422);
    expect(await User.findOne({ email: 'reg-company-orphan@t.demo' })).toBeNull();
  });

  it('leaves no COMPANY user without a CompanyProfile', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'reg-company-invariant@t.demo',
      password: TEST_PASSWORD,
      role: 'COMPANY',
      companyName: 'Invariant Co',
    });

    const companyUsers = await User.find({ role: 'COMPANY' });
    expect(companyUsers.length).toBeGreaterThan(0);
    for (const u of companyUsers) {
      expect(await CompanyProfile.findOne({ user: u._id })).not.toBeNull();
    }
  });

  it('POST /register rejects invalid role', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'reg-bad@t.demo',
      password: TEST_PASSWORD,
      role: 'ADMIN',
      fullName: 'Bad',
    });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('POST /login with valid credentials sets cookies', async () => {
    const row = await createUserRow('STUDENT', { email: 'login-ok@t.demo' });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: row.email, password: row.password });
    expect(res.status).toBe(200);
    const cookies = parseSetCookie(res.headers['set-cookie'] as string[] | undefined);
    expect(cookies[COOKIE_NAMES.ACCESS]).toBeTruthy();
    expect(cookies[COOKIE_NAMES.REFRESH]).toBeTruthy();
  });

  it('POST /login with wrong password returns 401', async () => {
    const row = await createUserRow('STUDENT', { email: 'login-bad@t.demo' });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: row.email, password: 'Wrong@1234' });
    expect(res.status).toBe(401);
  });

  it('GET /me returns user with valid cookie and 401 without', async () => {
    const auth = await createUserAndLogin(app, 'STUDENT', { email: 'me@t.demo' });
    const ok = await request(app).get('/api/v1/auth/me').set('Cookie', auth.cookie);
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.email).toBe('me@t.demo');

    const unauth = await request(app).get('/api/v1/auth/me');
    expect(unauth.status).toBe(401);
  });

  it('POST /refresh rotates the refresh cookie', async () => {
    const row = await createUserRow('STUDENT', { email: 'rot@t.demo' });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: row.email, password: row.password });
    const loginCookies = parseSetCookie(login.headers['set-cookie'] as string[] | undefined);
    const originalRefresh = loginCookies[COOKIE_NAMES.REFRESH];
    expect(originalRefresh).toBeTruthy();

    const cookieHeader = `${COOKIE_NAMES.REFRESH}=${originalRefresh}`;
    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieHeader);
    expect(refresh.status).toBe(200);
    const rotated = parseSetCookie(refresh.headers['set-cookie'] as string[] | undefined);
    expect(rotated[COOKIE_NAMES.REFRESH]).toBeTruthy();
    expect(rotated[COOKIE_NAMES.REFRESH]).not.toBe(originalRefresh);
  });

  it('POST /logout clears auth cookies', async () => {
    const auth = await createUserAndLogin(app, 'STUDENT', { email: 'logout@t.demo' });
    const res = await request(app).post('/api/v1/auth/logout').set('Cookie', auth.cookie);
    expect(res.status).toBe(204);
    const setCookie = res.headers['set-cookie'] as string[] | undefined;
    expect(setCookie?.some((c) => c.startsWith(`${COOKIE_NAMES.ACCESS}=`))).toBe(true);
    expect(setCookie?.some((c) => c.startsWith(`${COOKIE_NAMES.REFRESH}=`))).toBe(true);
  });

  // The suite above creates users by inserting rows directly, so it never
  // exercised the one path that actually matters to someone signing up: the
  // credentials written by POST /register being read back by POST /login.
  describe('signup then login with the same credentials', () => {
    async function registerVia(payload: Record<string, unknown>) {
      const res = await request(app).post('/api/v1/auth/register').send(payload);
      expect(res.status).toBe(201);
      return res;
    }

    it('accepts the password a STUDENT signed up with', async () => {
      const institutionId = await ensureTestInstitution();
      const email = 'flow-student@t.demo';
      await registerVia({
        email,
        password: TEST_PASSWORD,
        role: 'STUDENT',
        fullName: 'Flow Student',
        institutionId,
      });

      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: TEST_PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.data.user.email).toBe(email);
      expect(login.body.data.user.role).toBe('STUDENT');
    });

    it('accepts the password a COMPANY signed up with', async () => {
      const email = 'flow-company@t.demo';
      await registerVia({
        email,
        password: TEST_PASSWORD,
        role: 'COMPANY',
        companyName: 'Flow Company',
      });

      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: TEST_PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.data.user.role).toBe('COMPANY');
    });

    it('accepts the password a FACULTY signed up with', async () => {
      const institutionId = await ensureTestInstitution();
      const email = 'flow-faculty@t.demo';
      await registerVia({
        email,
        password: TEST_PASSWORD,
        role: 'FACULTY',
        fullName: 'Flow Faculty',
        institutionId,
      });

      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: TEST_PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.data.user.role).toBe('FACULTY');
    });

    // Registration lowercases the address before storing it. If login did not
    // normalise identically, anyone who typed their email with different casing
    // than they signed up with would get "Invalid credentials" forever.
    it('is insensitive to the casing used at signup or at login', async () => {
      const institutionId = await ensureTestInstitution();
      await registerVia({
        email: 'Flow.Case@T.Demo',
        password: TEST_PASSWORD,
        role: 'STUDENT',
        fullName: 'Flow Case',
        institutionId,
      });

      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'FLOW.CASE@t.DEMO', password: TEST_PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.data.user.email).toBe('flow.case@t.demo');
    });

    it('survives a page reload: cookies from login satisfy GET /me', async () => {
      const institutionId = await ensureTestInstitution();
      const email = 'flow-reload@t.demo';
      await registerVia({
        email,
        password: TEST_PASSWORD,
        role: 'STUDENT',
        fullName: 'Flow Reload',
        institutionId,
      });

      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: TEST_PASSWORD });
      const cookie = (login.headers['set-cookie'] as string[] | undefined)
        ?.map((c) => c.split(';')[0])
        .join('; ');
      expect(cookie).toBeTruthy();

      const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookie!);
      expect(me.status).toBe(200);
      expect(me.body.data.user.email).toBe(email);
      expect(me.body.data.studentProfile?.fullName).toBe('Flow Reload');
    });

    it('rejects an unknown email with 401 and no account hint', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody-here@t.demo', password: TEST_PASSWORD });
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid credentials');
    });

    it('rejects a deactivated account with the same message as a bad password', async () => {
      const row = await createUserRow('STUDENT', { email: 'flow-inactive@t.demo' });
      await User.updateOne({ _id: row.userId }, { $set: { isActive: false } });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: row.email, password: row.password });
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid credentials');
    });
  });

  describe('session revocation', () => {
    it('POST /logout invalidates the refresh token server-side', async () => {
      const row = await createUserRow('STUDENT', { email: 'revoke@t.demo' });
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: row.email, password: row.password });
      const refreshToken = parseSetCookie(login.headers['set-cookie'] as string[] | undefined)[
        COOKIE_NAMES.REFRESH
      ];
      expect(refreshToken).toBeTruthy();

      const refreshCookie = `${COOKIE_NAMES.REFRESH}=${refreshToken}`;
      const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', refreshCookie);
      expect(logout.status).toBe(204);

      // Replaying the pre-logout refresh token must not mint a new session.
      // Clearing the cookies only disarms the browser's copy; this is what stops
      // a captured token from being usable for the rest of its 7-day life.
      const replay = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookie);
      expect(replay.status).toBe(401);
    });

    it('POST /logout succeeds when the caller has no usable cookies', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(204);
    });

    // Rotation bumps the stored version on every refresh, so two tabs refreshing
    // at once used to make the slower one look like a replay and force a logout.
    it('tolerates a second refresh racing the first', async () => {
      const row = await createUserRow('STUDENT', { email: 'race@t.demo' });
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: row.email, password: row.password });
      const refreshToken = parseSetCookie(login.headers['set-cookie'] as string[] | undefined)[
        COOKIE_NAMES.REFRESH
      ];
      const refreshCookie = `${COOKIE_NAMES.REFRESH}=${refreshToken}`;

      const first = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie);
      expect(first.status).toBe(200);

      const second = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie);
      expect(second.status).toBe(200);
    });

    it('rejects a refresh token from two rotations ago', async () => {
      const row = await createUserRow('STUDENT', { email: 'stale@t.demo' });
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: row.email, password: row.password });
      const original = parseSetCookie(login.headers['set-cookie'] as string[] | undefined)[
        COOKIE_NAMES.REFRESH
      ];
      const originalCookie = `${COOKIE_NAMES.REFRESH}=${original}`;

      const first = await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);
      const rotated = parseSetCookie(first.headers['set-cookie'] as string[] | undefined)[
        COOKIE_NAMES.REFRESH
      ];
      await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `${COOKIE_NAMES.REFRESH}=${rotated}`);

      const tooOld = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', originalCookie);
      expect(tooOld.status).toBe(401);
    });
  });
});
