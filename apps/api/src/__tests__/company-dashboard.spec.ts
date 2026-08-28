import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, hasTestDb } from './helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from './helpers/db';
import { createJobViaService, createSkillRow, createUserAndLogin } from './helpers/fixtures';

describe.skipIf(!hasTestDb)('company-dashboard', () => {
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

  it('GET /companies/me/dashboard returns correct shape and counts', async () => {
    const company = await createUserAndLogin(app, 'COMPANY', {
      email: 'dash-co@t.demo',
      companyName: 'Dashboard Co',
    });
    const skill = await createSkillRow('React');
    const job1 = await createJobViaService(company.userId, {
      title: 'Dash Job 1',
      requiredSkillIds: [String(skill._id)],
    });
    await createJobViaService(company.userId, {
      title: 'Dash Job 2',
      requiredSkillIds: [String(skill._id)],
    });

    const student = await createUserAndLogin(app, 'STUDENT', { email: 'dash-st@t.demo' });
    const applyRes = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', student.cookie)
      .send({ opportunityType: 'JOB', opportunityId: job1.id });
    expect(applyRes.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/companies/me/dashboard')
      .set('Cookie', company.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      activeJobsCount: 2,
      activeInternshipsCount: 0,
      applicantsCount: 1,
      interviewsCount: 0,
    });
    expect(Array.isArray(res.body.data.recentApplicants)).toBe(true);
    expect(res.body.data.recentApplicants).toHaveLength(1);
    expect(Array.isArray(res.body.data.upcomingInterviews)).toBe(true);
  });

  it('GET /companies/me/dashboard rejects non-company', async () => {
    const student = await createUserAndLogin(app, 'STUDENT', { email: 'dash-block@t.demo' });
    const res = await request(app)
      .get('/api/v1/companies/me/dashboard')
      .set('Cookie', student.cookie);
    expect(res.status).toBe(403);
  });
});
