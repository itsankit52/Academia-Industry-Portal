/**
 * Security regression tests for POST /auth/google/link (ISS-01 CSRF account
 * takeover, ISS-02 silent Google identity replacement) and the global CSRF
 * Origin guard.
 *
 * Token verification is NOT mocked: google-auth-library's real verifier runs
 * (signature, audience, issuer, expiry). Only its certificate download is
 * pointed at a key pair generated for this run, so tests can mint tokens.
 */
import crypto from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { createTestApp, hasTestDb } from './helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from './helpers/db';
import { User } from '../models';
import { TEST_PASSWORD, createUserAndLogin, type CreatedAuth } from './helpers/fixtures';

const KID = 'link-spec-kid';
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const TRUSTED_ORIGIN = new URL(env.FRONTEND_URL).origin;
const LINK = '/api/v1/auth/google/link';

function googleToken(sub: string, overrides: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: 'https://accounts.google.com',
      aud: env.GOOGLE_CLIENT_ID,
      sub,
      email: `${sub}@example.test`,
      email_verified: true,
      iat: now - 5,
      exp: now + 3600,
      ...overrides,
    },
    PRIVATE_PEM,
    { algorithm: 'RS256', keyid: KID },
  );
}

async function googleIdOf(userId: string): Promise<string | undefined> {
  const u = await User.findById(userId).select('+googleId');
  return u?.get('googleId') as string | undefined;
}

describe.skipIf(!hasTestDb)('POST /auth/google/link — CSRF & identity replacement', () => {
  const app = createTestApp();
  let victim: CreatedAuth;

  const link = (body: object, cookie?: string, origin: string | null = TRUSTED_ORIGIN) => {
    let r = request(app).post(LINK);
    if (origin !== null) r = r.set('Origin', origin);
    if (cookie) r = r.set('Cookie', cookie);
    return r.send(body);
  };

  beforeAll(async () => {
    await connectTestDb();
    await User.syncIndexes();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
    vi.spyOn(OAuth2Client.prototype, 'getFederatedSignonCertsAsync').mockResolvedValue({
      certs: { [KID]: PUBLIC_PEM },
      format: 'PEM',
    } as never);
    victim = await createUserAndLogin(app, 'COMPANY');
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Request-origin / content-type controls ───────────────────────────────

  it('rejects an unauthenticated request with 401', async () => {
    const res = await link({ idToken: googleToken('g-unauth'), currentPassword: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('rejects a cross-site URL-encoded form POST carrying the victim session (CSRF)', async () => {
    const res = await request(app)
      .post(LINK)
      .set('Origin', 'https://evil.example')
      .set('Cookie', victim.cookie)
      .type('form')
      .send(`idToken=${googleToken('g-attacker')}`);
    expect(res.status).toBe(403);
    expect(await googleIdOf(victim.userId)).toBeUndefined();
  });

  it('rejects a URL-encoded body even from the trusted origin with 415', async () => {
    const res = await request(app)
      .post(LINK)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', victim.cookie)
      .type('form')
      .send(`idToken=${googleToken('g-form')}&currentPassword=${TEST_PASSWORD}`);
    expect(res.status).toBe(415);
    expect(await googleIdOf(victim.userId)).toBeUndefined();
  });

  it('rejects a text/plain body with 415', async () => {
    const res = await request(app)
      .post(LINK)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', victim.cookie)
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify({ idToken: googleToken('g-text'), currentPassword: TEST_PASSWORD }));
    expect(res.status).toBe(415);
  });

  it('rejects a cross-origin JSON request with 403', async () => {
    const res = await link(
      { idToken: googleToken('g-xo'), currentPassword: TEST_PASSWORD },
      victim.cookie,
      'https://evil.example',
    );
    expect(res.status).toBe(403);
    expect(await googleIdOf(victim.userId)).toBeUndefined();
  });

  it('rejects a request with no Origin header with 403', async () => {
    const res = await link(
      { idToken: googleToken('g-noorigin'), currentPassword: TEST_PASSWORD },
      victim.cookie,
      null,
    );
    expect(res.status).toBe(403);
  });

  it.each([
    'null',
    `${TRUSTED_ORIGIN}.evil.example`,
    `${TRUSTED_ORIGIN}:1`,
    TRUSTED_ORIGIN.toUpperCase(),
  ])('rejects a non-exact Origin (%s) with 403', async (origin) => {
    const res = await link(
      { idToken: googleToken('g-lookalike'), currentPassword: TEST_PASSWORD },
      victim.cookie,
      origin,
    );
    expect(res.status).toBe(403);
    expect(await googleIdOf(victim.userId)).toBeUndefined();
  });

  // ── Proof of ownership ───────────────────────────────────────────────────

  it('rejects an invalid Google ID token with 401', async () => {
    const forged = jwt.sign(
      {
        iss: 'https://accounts.google.com',
        aud: env.GOOGLE_CLIENT_ID,
        sub: 'g-forged',
        email_verified: true,
      },
      crypto
        .generateKeyPairSync('rsa', { modulusLength: 2048 })
        .privateKey.export({ type: 'pkcs8', format: 'pem' }),
      { algorithm: 'RS256', keyid: KID, expiresIn: 3600 },
    );
    const res = await link({ idToken: forged, currentPassword: TEST_PASSWORD }, victim.cookie);
    expect(res.status).toBe(401);
    expect(await googleIdOf(victim.userId)).toBeUndefined();
  });

  it('rejects a valid but stale Google token (not fresh proof) with 401', async () => {
    const now = Math.floor(Date.now() / 1000);
    const res = await link(
      {
        idToken: googleToken('g-stale', { iat: now - 20 * 60, exp: now + 1800 }),
        currentPassword: TEST_PASSWORD,
      },
      victim.cookie,
    );
    expect(res.status).toBe(401);
    expect(await googleIdOf(victim.userId)).toBeUndefined();
  });

  it('requires the current password (400 when missing, 403 when wrong)', async () => {
    const missing = await link({ idToken: googleToken('g-pw') }, victim.cookie);
    expect(missing.status).toBe(400);
    const wrong = await link(
      { idToken: googleToken('g-pw'), currentPassword: 'not-the-password' },
      victim.cookie,
    );
    expect(wrong.status).toBe(403);
    expect(await googleIdOf(victim.userId)).toBeUndefined();
  });

  it('rejects unknown body fields with 422', async () => {
    const res = await link(
      { idToken: googleToken('g-extra'), currentPassword: TEST_PASSWORD, role: 'ADMIN' },
      victim.cookie,
    );
    expect(res.status).toBe(422);
  });

  // ── Linking semantics ────────────────────────────────────────────────────

  it('links on first use from the trusted origin with valid proofs', async () => {
    const res = await link(
      { idToken: googleToken('g-first'), currentPassword: TEST_PASSWORD },
      victim.cookie,
    );
    expect(res.status).toBe(200);
    const u = await User.findById(victim.userId).select('+googleId');
    expect(u?.get('googleId')).toBe('g-first');
    expect(u?.authProvider).toBe('both');
  });

  it('is idempotent when re-linking the same Google identity', async () => {
    await link({ idToken: googleToken('g-same'), currentPassword: TEST_PASSWORD }, victim.cookie);
    const again = await link(
      { idToken: googleToken('g-same'), currentPassword: TEST_PASSWORD },
      victim.cookie,
    );
    expect(again.status).toBe(200);
    expect(await googleIdOf(victim.userId)).toBe('g-same');
  });

  it('refuses to replace an existing Google identity with a different one (409)', async () => {
    await link(
      { idToken: googleToken('g-original'), currentPassword: TEST_PASSWORD },
      victim.cookie,
    );
    const res = await link(
      { idToken: googleToken('g-replacement'), currentPassword: TEST_PASSWORD },
      victim.cookie,
    );
    expect(res.status).toBe(409);
    expect(await googleIdOf(victim.userId)).toBe('g-original');
  });

  it('refuses a Google identity already owned by another user (409)', async () => {
    const other = await createUserAndLogin(app, 'COMPANY');
    expect(
      (
        await link(
          { idToken: googleToken('g-owned'), currentPassword: TEST_PASSWORD },
          other.cookie,
        )
      ).status,
    ).toBe(200);
    const res = await link(
      { idToken: googleToken('g-owned'), currentPassword: TEST_PASSWORD },
      victim.cookie,
    );
    expect(res.status).toBe(409);
    expect(await googleIdOf(victim.userId)).toBeUndefined();
    expect(await googleIdOf(other.userId)).toBe('g-owned');
  });

  it('lets only one of two concurrent different identities link to one account', async () => {
    const [a, b] = await Promise.all([
      link({ idToken: googleToken('g-race-a'), currentPassword: TEST_PASSWORD }, victim.cookie),
      link({ idToken: googleToken('g-race-b'), currentPassword: TEST_PASSWORD }, victim.cookie),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const winner = a.status === 200 ? 'g-race-a' : 'g-race-b';
    expect(await googleIdOf(victim.userId)).toBe(winner);
  });

  it('lets only one of two accounts concurrently claim the same Google identity', async () => {
    const other = await createUserAndLogin(app, 'COMPANY');
    const token = googleToken('g-race-shared');
    const [a, b] = await Promise.all([
      link({ idToken: token, currentPassword: TEST_PASSWORD }, victim.cookie),
      link({ idToken: token, currentPassword: TEST_PASSWORD }, other.cookie),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await User.countDocuments({ googleId: 'g-race-shared' })).toBe(1);
  });

  // ── Session preservation & existing login paths ──────────────────────────

  it('leaves the session intact after rejected link attempts', async () => {
    const rejected = [
      await link(
        { idToken: googleToken('g-s1'), currentPassword: TEST_PASSWORD },
        victim.cookie,
        'https://evil.example',
      ),
      await link({ idToken: 'not-a-jwt', currentPassword: TEST_PASSWORD }, victim.cookie),
      await link(
        { idToken: googleToken('g-s2'), currentPassword: 'wrong-password' },
        victim.cookie,
      ),
    ];
    for (const r of rejected) {
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.headers['set-cookie']).toBeUndefined();
    }
    const me = await request(app).get('/api/v1/auth/me').set('Cookie', victim.cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.id).toBe(victim.userId);
  });

  it('keeps Google login and password login working after a successful link', async () => {
    await link({ idToken: googleToken('g-login'), currentPassword: TEST_PASSWORD }, victim.cookie);
    const google = await request(app)
      .post('/api/v1/auth/google')
      .set('Origin', TRUSTED_ORIGIN)
      .send({ idToken: googleToken('g-login') });
    expect(google.status).toBe(200);
    expect(google.body.data.user.id).toBe(victim.userId);
    const password = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({ email: victim.email, password: TEST_PASSWORD });
    expect(password.status).toBe(200);
  });
});

describe.skipIf(!hasTestDb)('global CSRF Origin guard', () => {
  const app = createTestApp();
  let user: CreatedAuth;

  beforeAll(async () => {
    await connectTestDb();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
    user = await createUserAndLogin(app, 'COMPANY');
  });

  it('rejects a cross-site cookie-bearing state change (change-password) with 403', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Origin', 'https://evil.example')
      .set('Cookie', user.cookie)
      .type('form')
      .send(`currentPassword=${TEST_PASSWORD}&newPassword=Attacker@123`);
    expect(res.status).toBe(403);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
  });

  it('allows the same request from the trusted origin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', user.cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'Changed@1234' });
    expect(res.status).toBe(204);
  });

  it('does not affect requests without a session cookie (login, signup) or safe methods', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: user.email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Origin', 'https://evil.example')
      .set('Cookie', user.cookie);
    expect(me.status).toBe(200);
  });

  it('lets cookie-bearing logout and refresh through from the trusted origin', async () => {
    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', user.cookie);
    expect(refresh.status).toBe(200);
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', user.cookie);
    expect(logout.status).toBe(204);
  });
});
