import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, hasTestDb } from './helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from './helpers/db';
import { createJobViaService, createSkillRow, createUserAndLogin } from './helpers/fixtures';

describe.skipIf(!hasTestDb)('candidate-details', () => {
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

  async function setupApplication() {
    const company = await createUserAndLogin(app, 'COMPANY', {
      email: 'cand-co@t.demo',
      companyName: 'Candidate Co',
    });
    const skill = await createSkillRow('TypeScript');
    const job = await createJobViaService(company.userId, {
      title: 'Candidate Job',
      requiredSkillIds: [String(skill._id)],
    });
    const student = await createUserAndLogin(app, 'STUDENT', { email: 'cand-st@t.demo' });
    const applyRes = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', student.cookie)
      .send({ opportunityType: 'JOB', opportunityId: job.id });
    return {
      company,
      student,
      applicationId: applyRes.body.data.id as string,
      jobId: job.id,
      skillId: String(skill._id),
    };
  }

  it('GET /applications/:id/candidate returns populated details for owner company', async () => {
    const { company, applicationId, jobId } = await setupApplication();
    const res = await request(app)
      .get(`/api/v1/applications/${applicationId}/candidate`)
      .set('Cookie', company.cookie);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.id).toBe(applicationId);
    expect(data.student.fullName).toBe('Test Student');
    expect(data.student.email).toBe('cand-st@t.demo');
    expect(Array.isArray(data.skills)).toBe(true);
    expect(data.opportunity.id).toBe(jobId);
    expect(data.opportunity.title).toBe('Candidate Job');
    expect(data.opportunity.type).toBe('JOB');
    expect(data.opportunity.company.name).toBe('Candidate Co');
    expect(data.application.status).toBe('APPLIED');
    expect(Array.isArray(data.application.matchedSkills)).toBe(true);
    expect(Array.isArray(data.application.missingSkills)).toBe(true);
    expect(Array.isArray(data.application.timeline)).toBe(true);
  });

  it('GET /applications/:id/candidate as ADMIN succeeds', async () => {
    const { applicationId } = await setupApplication();
    const admin = await createUserAndLogin(app, 'ADMIN', { email: 'cand-admin@t.demo' });
    const res = await request(app)
      .get(`/api/v1/applications/${applicationId}/candidate`)
      .set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
  });

  it('GET /applications/:id/candidate blocks another company', async () => {
    const { applicationId } = await setupApplication();
    const otherCompany = await createUserAndLogin(app, 'COMPANY', {
      email: 'cand-other@t.demo',
      companyName: 'Other Co',
    });
    const res = await request(app)
      .get(`/api/v1/applications/${applicationId}/candidate`)
      .set('Cookie', otherCompany.cookie);
    expect(res.status).toBe(403);
  });

  it('GET /applications/:id/candidate as STUDENT returns 403', async () => {
    const { applicationId, student } = await setupApplication();
    const res = await request(app)
      .get(`/api/v1/applications/${applicationId}/candidate`)
      .set('Cookie', student.cookie);
    expect(res.status).toBe(403);
  });
});
