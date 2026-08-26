import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, hasTestDb } from './helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from './helpers/db';
import {
  createJobViaService,
  createSkillRow,
  createUserAndLogin,
} from './helpers/fixtures';

describe.skipIf(!hasTestDb)('applications', () => {
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

  async function setupCompanyWithJob() {
    const company = await createUserAndLogin(app, 'COMPANY', {
      email: 'app-co@t.demo',
      companyName: 'App Co',
    });
    const skill = await createSkillRow('React');
    const job = await createJobViaService(company.userId, {
      title: 'Applications Test Job',
      requiredSkillIds: [String(skill._id)],
    });
    return { company, job };
  }

  it('POST /applications as STUDENT returns 201 with matchScore snapshot', async () => {
    const { job } = await setupCompanyWithJob();
    const student = await createUserAndLogin(app, 'STUDENT', { email: 'app-st@t.demo' });
    const res = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', student.cookie)
      .send({ opportunityType: 'JOB', opportunityId: String(job._id) });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('APPLIED');
    expect(typeof res.body.data.matchScore).toBe('number');
    expect(res.body.data.timeline).toHaveLength(1);
    expect(res.body.data.timeline[0].status).toBe('APPLIED');
  });

  it('POST /applications duplicate returns 409', async () => {
    const { job } = await setupCompanyWithJob();
    const student = await createUserAndLogin(app, 'STUDENT', { email: 'app-dup@t.demo' });
    const first = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', student.cookie)
      .send({ opportunityType: 'JOB', opportunityId: String(job._id) });
    expect(first.status).toBe(201);
    const dup = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', student.cookie)
      .send({ opportunityType: 'JOB', opportunityId: String(job._id) });
    expect(dup.status).toBe(409);
  });

  it('PATCH /applications/:id/status as COMPANY updates status and appends timeline', async () => {
    const { company, job } = await setupCompanyWithJob();
    const student = await createUserAndLogin(app, 'STUDENT', { email: 'app-patch@t.demo' });
    const created = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', student.cookie)
      .send({ opportunityType: 'JOB', opportunityId: String(job._id) });
    const appId = created.body.data.id as string;

    const res = await request(app)
      .patch(`/api/v1/applications/${appId}/status`)
      .set('Cookie', company.cookie)
      .send({ status: 'SHORTLISTED', note: 'Looks promising' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SHORTLISTED');
    expect(res.body.data.timeline).toHaveLength(2);
    expect(res.body.data.timeline[1].status).toBe('SHORTLISTED');
    expect(res.body.data.timeline[1].note).toBe('Looks promising');
  });
});
