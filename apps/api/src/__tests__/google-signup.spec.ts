/**
 * POST /auth/google signup (ISS-05): role-specific validation shared with
 * /auth/register, controlled 422s instead of 500s, duplicate handling and
 * rollback. Google token verification runs for real (see helpers/googleTokens).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createTestApp, hasTestDb } from './helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from './helpers/db';
import { googleIdToken, useTestGoogleCerts } from './helpers/googleTokens';
import { ensureTestInstitution, createUserRow, parseSetCookie } from './helpers/fixtures';
import { CompanyProfile, FacultyProfile, Institution, StudentProfile, User } from '../models';

const GOOGLE = '/api/v1/auth/google';

const institutionFields = {
  institutionName: 'Google Signup Institute',
  institutionDomain: 'gsi.edu',
  institutionAddress: '1 Campus Road',
  institutionCity: 'Pune',
  institutionState: 'MH',
};

describe.skipIf(!hasTestDb)('POST /auth/google — role-specific signup', () => {
  const app = createTestApp();
  let institutionId: string;

  const signup = (body: Record<string, unknown>) => request(app).post(GOOGLE).send(body);
  const counts = async () => ({
    users: await User.countDocuments(),
    institutions: await Institution.countDocuments(),
    students: await StudentProfile.countDocuments(),
    companies: await CompanyProfile.countDocuments(),
    faculty: await FacultyProfile.countDocuments(),
  });

  beforeAll(async () => {
    await connectTestDb();
    await User.syncIndexes();
    await Institution.syncIndexes();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
    useTestGoogleCerts();
    institutionId = await ensureTestInstitution(); // VERIFIED, code TESTINST
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Valid signup, all four roles ─────────────────────────────────────────

  it('STUDENT: creates user + StudentProfile and a session', async () => {
    const res = await signup({
      idToken: googleIdToken('g-student'),
      role: 'STUDENT',
      fullName: 'Google Student',
      institutionId,
      institutionCode: 'TESTINST',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('STUDENT');
    expect(
      Object.keys(parseSetCookie(res.headers['set-cookie'] as unknown as string[])),
    ).toHaveLength(2);
    const user = await User.findOne({ email: 'g-student@example.test' }).select('+googleId');
    expect(user?.get('googleId')).toBe('g-student');
    expect(await StudentProfile.findOne({ user: user?._id })).toMatchObject({
      fullName: 'Google Student',
    });
  });

  it('COMPANY: creates user + CompanyProfile with the given company name', async () => {
    const res = await signup({
      idToken: googleIdToken('g-company'),
      role: 'COMPANY',
      companyName: 'Acme Corp',
    });
    expect(res.status).toBe(200);
    const user = await User.findOne({ email: 'g-company@example.test' });
    expect(await CompanyProfile.findOne({ user: user?._id })).toMatchObject({
      companyName: 'Acme Corp',
    });
  });

  it('FACULTY: creates user + FacultyProfile linked to the institution', async () => {
    const res = await signup({
      idToken: googleIdToken('g-faculty'),
      role: 'FACULTY',
      fullName: 'Dr. Google',
      institutionId,
      designation: 'Professor',
      department: 'CS',
    });
    expect(res.status).toBe(200);
    const user = await User.findOne({ email: 'g-faculty@example.test' });
    const profile = await FacultyProfile.findOne({ user: user?._id });
    expect(String(profile?.institution)).toBe(institutionId);
    expect(profile).toMatchObject({ designation: 'Professor', department: 'CS' });
  });

  it('INSTITUTION: creates user + PENDING institution owned by the user', async () => {
    const res = await signup({
      idToken: googleIdToken('g-inst'),
      role: 'INSTITUTION',
      ...institutionFields,
    });
    expect(res.status).toBe(200);
    const user = await User.findOne({ email: 'g-inst@example.test' });
    const inst = await Institution.findById(user?.institution);
    expect(inst).toMatchObject({
      name: 'Google Signup Institute',
      domain: 'gsi.edu',
      verificationStatus: 'PENDING',
    });
  });

  // ── Controlled 422s, nothing written ─────────────────────────────────────

  it.each([
    ['COMPANY without companyName', { role: 'COMPANY' }, 'companyName'],
    ['COMPANY with blank companyName', { role: 'COMPANY', companyName: '' }, 'companyName'],
    [
      'STUDENT without institutionCode',
      { role: 'STUDENT', fullName: 'S', institutionId: 'INST' },
      'institutionCode',
    ],
    [
      'STUDENT without fullName',
      { role: 'STUDENT', institutionId: 'INST', institutionCode: 'TESTINST' },
      'fullName',
    ],
    ['FACULTY without institutionId', { role: 'FACULTY', fullName: 'F' }, 'institutionId'],
    [
      'INSTITUTION without address/city/state',
      { role: 'INSTITUTION', institutionName: 'N', institutionDomain: 'n.edu' },
      'institutionAddress',
    ],
    [
      'INSTITUTION without domain',
      { role: 'INSTITUTION', ...institutionFields, institutionDomain: undefined },
      'institutionDomain',
    ],
    [
      'INSTITUTION with URL as domain',
      { role: 'INSTITUTION', ...institutionFields, institutionDomain: 'https://gsi.edu/x' },
      'institutionDomain',
    ],
    [
      'INSTITUTION with spaced domain',
      { role: 'INSTITUTION', ...institutionFields, institutionDomain: 'not a domain' },
      'institutionDomain',
    ],
    [
      'INSTITUTION with lowercase custom code',
      { role: 'INSTITUTION', ...institutionFields, institutionCode: 'abc123' },
      'institutionCode',
    ],
    ['unknown role', { role: 'ALUMNI' }, 'role'],
    ['ADMIN role escalation', { role: 'ADMIN' }, 'role'],
  ])('%s → 422 on %s, nothing created', async (_label, extra, field) => {
    const body = { idToken: googleIdToken('g-invalid'), ...extra } as Record<string, unknown>;
    if (body.institutionId === 'INST') body.institutionId = institutionId;
    const before = await counts();
    const res = await signup(body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect((res.body.error.details as Array<{ path: string }>).map((d) => d.path)).toContain(field);
    expect(await counts()).toEqual(before);
  });

  it('first call without a role still returns requiresOnboarding (not a validation error)', async () => {
    const res = await signup({ idToken: googleIdToken('g-new') });
    expect(res.status).toBe(200);
    expect(res.body.data.requiresOnboarding).toBe(true);
  });

  // ── Duplicates ───────────────────────────────────────────────────────────

  it('duplicate email: a password account with that email is not taken over or duplicated', async () => {
    const existing = await createUserRow('COMPANY', { email: 'g-dupemail@example.test' });
    const res = await signup({
      idToken: googleIdToken('g-dupemail'),
      role: 'COMPANY',
      companyName: 'X',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.emailConflict).toBe(true);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(await User.countDocuments({ email: 'g-dupemail@example.test' })).toBe(1);
    const u = await User.findById(existing.userId).select('+googleId');
    expect(u?.get('googleId')).toBeUndefined();
  });

  it('duplicate email race: two Google identities with one email → one account, loser gets 409', async () => {
    const email = 'shared@example.test';
    const [a, b] = await Promise.all([
      signup({ idToken: googleIdToken('g-race-1', { email }), role: 'COMPANY', companyName: 'A' }),
      signup({ idToken: googleIdToken('g-race-2', { email }), role: 'COMPANY', companyName: 'B' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await User.countDocuments({ email })).toBe(1);
    expect(await CompanyProfile.countDocuments()).toBe(1);
  });

  it('duplicate Google identity: signing up again logs into the existing account, role unchanged', async () => {
    await signup({ idToken: googleIdToken('g-dupid'), role: 'COMPANY', companyName: 'First' });
    const again = await signup({
      idToken: googleIdToken('g-dupid'),
      role: 'INSTITUTION',
      ...institutionFields,
    });
    expect(again.status).toBe(200);
    expect(again.body.data.user.role).toBe('COMPANY');
    expect(await User.countDocuments({ googleId: 'g-dupid' })).toBe(1);
    expect(await Institution.countDocuments({ domain: 'gsi.edu' })).toBe(0);
  });

  it('duplicate Google identity race: concurrent signups create exactly one account', async () => {
    const body = { idToken: googleIdToken('g-dupid-race'), role: 'COMPANY', companyName: 'Race' };
    const results = await Promise.all([signup(body), signup(body), signup(body)]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.every((r) => r.status === 200 || r.status === 409)).toBe(true);
    expect(await User.countDocuments({ googleId: 'g-dupid-race' })).toBe(1);
    expect(await CompanyProfile.countDocuments({ companyName: 'Race' })).toBe(1);
  });

  // ── Rollback ─────────────────────────────────────────────────────────────

  it('rolls back the user when the institution domain is already registered (409)', async () => {
    await signup({
      idToken: googleIdToken('g-domain-1'),
      role: 'INSTITUTION',
      ...institutionFields,
    });
    const before = await counts();
    const res = await signup({
      idToken: googleIdToken('g-domain-2'),
      role: 'INSTITUTION',
      ...institutionFields,
      institutionName: 'Another Name',
    });
    expect(res.status).toBe(409);
    expect(await counts()).toEqual(before);
  });

  it('rolls back the user when the custom institution code is taken (409)', async () => {
    const before = await counts();
    const res = await signup({
      idToken: googleIdToken('g-code'),
      role: 'INSTITUTION',
      ...institutionFields,
      institutionCode: 'TESTINST',
    });
    expect(res.status).toBe(409);
    expect(await counts()).toEqual(before);
  });

  it('rolls back both the user and the new institution when a later write fails', async () => {
    const before = await counts();
    vi.spyOn(User.prototype, 'save').mockRejectedValueOnce(new Error('simulated write failure'));
    const res = await signup({
      idToken: googleIdToken('g-midfail'),
      role: 'INSTITUTION',
      ...institutionFields,
    });
    expect(res.status).toBe(500);
    expect(await counts()).toEqual(before);
  });

  it('rolls back the user when the institution is not verified (400)', async () => {
    const pending = await Institution.create({
      name: 'Pending U',
      code: 'PENDU1',
      domain: 'pendu.edu',
      address: 'a',
      city: 'c',
      state: 's',
      contactEmail: 'p@pendu.edu',
      verificationStatus: 'PENDING',
    });
    const before = await counts();
    const res = await signup({
      idToken: googleIdToken('g-pending'),
      role: 'FACULTY',
      fullName: 'F',
      institutionId: String(pending._id),
    });
    expect(res.status).toBe(400);
    expect(await counts()).toEqual(before);
  });
});

describe.skipIf(!hasTestDb)('POST /auth/register — shares the role rules', () => {
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

  it('still registers a COMPANY with a password', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'pw-company@example.test',
      password: 'Test@1234',
      role: 'COMPANY',
      companyName: 'PW Co',
    });
    expect(res.status).toBe(201);
  });

  it('still registers an INSTITUTION with a valid domain', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'pw-inst@example.test',
        password: 'Test@1234',
        role: 'INSTITUTION',
        ...institutionFields,
      });
    expect(res.status).toBe(201);
  });

  it('applies the same domain rule as Google signup', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'pw-inst2@example.test',
        password: 'Test@1234',
        role: 'INSTITUTION',
        ...institutionFields,
        institutionDomain: 'http://gsi.edu',
      });
    expect(res.status).toBe(422);
    expect(await User.countDocuments()).toBe(0);
  });
});
