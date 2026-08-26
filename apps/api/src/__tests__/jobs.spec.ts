import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, hasTestDb } from './helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from './helpers/db';
import { createSkillRow, createUserAndLogin } from './helpers/fixtures';

function jobPayload(skillId: string) {
  return {
    title: 'Test Frontend Job',
    description:
      'A comprehensive test frontend role used by the integration test suite to exercise creation, listing, updating, and deletion paths.',
    location: 'Bengaluru, India',
    workMode: 'HYBRID',
    employmentType: 'FULL_TIME',
    eligibleBranches: ['Computer Science'],
    eligibleGradYears: [2025, 2026],
    requiredSkills: [skillId],
    preferredSkills: [],
    openings: 1,
    status: 'PUBLISHED',
  };
}

describe.skipIf(!hasTestDb)('jobs', () => {
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

  it('POST /jobs as COMPANY returns 201', async () => {
    const company = await createUserAndLogin(app, 'COMPANY', {
      email: 'jobs-co@t.demo',
      companyName: 'Jobs Co',
    });
    const skill = await createSkillRow('JavaScript');
    const res = await request(app)
      .post('/api/v1/jobs')
      .set('Cookie', company.cookie)
      .send(jobPayload(String(skill._id)));
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Test Frontend Job');
  });

  it('POST /jobs as STUDENT returns 403', async () => {
    const student = await createUserAndLogin(app, 'STUDENT', { email: 'jobs-st@t.demo' });
    const skill = await createSkillRow('React');
    const res = await request(app)
      .post('/api/v1/jobs')
      .set('Cookie', student.cookie)
      .send(jobPayload(String(skill._id)));
    expect(res.status).toBe(403);
  });

  it('GET /jobs returns paginated list', async () => {
    const company = await createUserAndLogin(app, 'COMPANY', {
      email: 'jobs-list@t.demo',
      companyName: 'List Co',
    });
    const skill = await createSkillRow('TypeScript');
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/api/v1/jobs')
        .set('Cookie', company.cookie)
        .send({ ...jobPayload(String(skill._id)), title: `Test Job ${i}` });
    }
    const res = await request(app).get('/api/v1/jobs?page=1&pageSize=2');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(2);
    expect(res.body.data.total).toBe(3);
  });

  it('GET /jobs/:id returns the job', async () => {
    const company = await createUserAndLogin(app, 'COMPANY', {
      email: 'jobs-getone@t.demo',
      companyName: 'GetOne Co',
    });
    const skill = await createSkillRow('Node.js');
    const created = await request(app)
      .post('/api/v1/jobs')
      .set('Cookie', company.cookie)
      .send(jobPayload(String(skill._id)));
    const id = created.body.data.id as string;
    const res = await request(app).get(`/api/v1/jobs/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });

  it('PUT /jobs/:id as owner updates the job', async () => {
    const company = await createUserAndLogin(app, 'COMPANY', {
      email: 'jobs-upd@t.demo',
      companyName: 'Upd Co',
    });
    const skill = await createSkillRow('MongoDB');
    const created = await request(app)
      .post('/api/v1/jobs')
      .set('Cookie', company.cookie)
      .send(jobPayload(String(skill._id)));
    const id = created.body.data.id as string;
    const res = await request(app)
      .put(`/api/v1/jobs/${id}`)
      .set('Cookie', company.cookie)
      .send({ title: 'Updated Title' });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
  });

  it('DELETE /jobs/:id as ADMIN returns 204', async () => {
    const company = await createUserAndLogin(app, 'COMPANY', {
      email: 'jobs-del-co@t.demo',
      companyName: 'Del Co',
    });
    const admin = await createUserAndLogin(app, 'ADMIN', { email: 'jobs-del-admin@t.demo' });
    const skill = await createSkillRow('Python');
    const created = await request(app)
      .post('/api/v1/jobs')
      .set('Cookie', company.cookie)
      .send(jobPayload(String(skill._id)));
    const id = created.body.data.id as string;
    const res = await request(app)
      .delete(`/api/v1/jobs/${id}`)
      .set('Cookie', admin.cookie);
    expect(res.status).toBe(204);
  });
});
