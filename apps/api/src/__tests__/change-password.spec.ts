import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { COOKIE_NAMES } from '@aip/config';
import { createTestApp, hasTestDb } from './helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from './helpers/db';
import { TEST_PASSWORD, createUserRow, parseSetCookie } from './helpers/fixtures';

async function loginRaw(app: ReturnType<typeof createTestApp>, email: string, password: string) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return {
    status: res.status,
    setCookie: res.headers['set-cookie'] as string[] | undefined,
  };
}

function cookieHeader(name: string, value: string): string {
  return `${name}=${value}`;
}

describe.skipIf(!hasTestDb)('change-password', () => {
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

  it('POST /auth/change-password with valid current password rotates hash and clears cookies', async () => {
    const row = await createUserRow('STUDENT', { email: 'cp-ok@t.demo' });
    const login = await loginRaw(app, row.email, row.password);
    const loginCookies = parseSetCookie(login.setCookie);
    const accessCookie = cookieHeader(COOKIE_NAMES.ACCESS, loginCookies[COOKIE_NAMES.ACCESS]!);

    const newPassword = 'NewPass@1234';
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', accessCookie)
      .send({ currentPassword: row.password, newPassword });

    expect(res.status).toBe(204);
    const clear = res.headers['set-cookie'] as string[] | undefined;
    expect(clear?.some((c) => c.startsWith(`${COOKIE_NAMES.ACCESS}=`))).toBe(true);
    expect(clear?.some((c) => c.startsWith(`${COOKIE_NAMES.REFRESH}=`))).toBe(true);

    const oldLogin = await loginRaw(app, row.email, row.password);
    expect(oldLogin.status).toBe(401);

    const newLogin = await loginRaw(app, row.email, newPassword);
    expect(newLogin.status).toBe(200);
  });

  it('POST /auth/change-password with wrong current password returns 401', async () => {
    const row = await createUserRow('STUDENT', { email: 'cp-bad@t.demo' });
    const login = await loginRaw(app, row.email, row.password);
    const cookies = parseSetCookie(login.setCookie);
    const accessCookie = cookieHeader(COOKIE_NAMES.ACCESS, cookies[COOKIE_NAMES.ACCESS]!);

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', accessCookie)
      .send({ currentPassword: 'Wrong@1234', newPassword: 'AnotherPass@1' });

    expect(res.status).toBe(401);
  });

  it('POST /auth/change-password without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'AnotherPass@1' });
    expect(res.status).toBe(401);
  });

  it('POST /auth/change-password invalidates previously issued refresh token', async () => {
    const row = await createUserRow('STUDENT', { email: 'cp-refresh@t.demo' });
    const login = await loginRaw(app, row.email, row.password);
    const cookies = parseSetCookie(login.setCookie);
    const accessCookie = cookieHeader(COOKIE_NAMES.ACCESS, cookies[COOKIE_NAMES.ACCESS]!);
    const originalRefresh = cookies[COOKIE_NAMES.REFRESH]!;

    const newPassword = 'AnotherNew@42';
    const change = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', accessCookie)
      .send({ currentPassword: row.password, newPassword });
    expect(change.status).toBe(204);

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieHeader(COOKIE_NAMES.REFRESH, originalRefresh));
    expect(refresh.status).toBe(401);
  });
});
