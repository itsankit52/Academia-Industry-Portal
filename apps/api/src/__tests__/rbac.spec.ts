import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, hasTestDb } from './helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from './helpers/db';
import { createUserAndLogin } from './helpers/fixtures';

describe.skipIf(!hasTestDb)('rbac', () => {
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

  it('ADMIN-only route /admin/users rejects STUDENT and COMPANY', async () => {
    const admin = await createUserAndLogin(app, 'ADMIN', { email: 'rbac-admin@t.demo' });
    const student = await createUserAndLogin(app, 'STUDENT', { email: 'rbac-st@t.demo' });
    const company = await createUserAndLogin(app, 'COMPANY', {
      email: 'rbac-co@t.demo',
      companyName: 'RBAC Co',
    });

    const okRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Cookie', admin.cookie);
    expect(okRes.status).toBe(200);

    const studentRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Cookie', student.cookie);
    expect(studentRes.status).toBe(403);

    const companyRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Cookie', company.cookie);
    expect(companyRes.status).toBe(403);
  });

  it('COMPANY-only route /companies/me rejects STUDENT and ADMIN', async () => {
    const admin = await createUserAndLogin(app, 'ADMIN', { email: 'rbac-co-admin@t.demo' });
    const student = await createUserAndLogin(app, 'STUDENT', { email: 'rbac-co-st@t.demo' });
    const company = await createUserAndLogin(app, 'COMPANY', {
      email: 'rbac-co-co@t.demo',
      companyName: 'RBAC Co Only',
    });

    const okRes = await request(app)
      .get('/api/v1/companies/me')
      .set('Cookie', company.cookie);
    expect(okRes.status).toBe(200);

    const studentRes = await request(app)
      .get('/api/v1/companies/me')
      .set('Cookie', student.cookie);
    expect(studentRes.status).toBe(403);

    const adminRes = await request(app)
      .get('/api/v1/companies/me')
      .set('Cookie', admin.cookie);
    expect(adminRes.status).toBe(403);
  });

  it('STUDENT-only route /students/me rejects COMPANY and ADMIN', async () => {
    const admin = await createUserAndLogin(app, 'ADMIN', { email: 'rbac-st-admin@t.demo' });
    const student = await createUserAndLogin(app, 'STUDENT', { email: 'rbac-st-only@t.demo' });
    const company = await createUserAndLogin(app, 'COMPANY', {
      email: 'rbac-st-co@t.demo',
      companyName: 'RBAC St Co',
    });

    const okRes = await request(app)
      .get('/api/v1/students/me')
      .set('Cookie', student.cookie);
    expect(okRes.status).toBe(200);

    const companyRes = await request(app)
      .get('/api/v1/students/me')
      .set('Cookie', company.cookie);
    expect(companyRes.status).toBe(403);

    const adminRes = await request(app)
      .get('/api/v1/students/me')
      .set('Cookie', admin.cookie);
    expect(adminRes.status).toBe(403);
  });
});
