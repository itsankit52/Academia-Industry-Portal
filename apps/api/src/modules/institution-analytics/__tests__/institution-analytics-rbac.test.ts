import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, hasTestDb } from '../../../__tests__/helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../../../__tests__/helpers/db';
import { createUserAndLogin, ensureTestInstitution } from '../../../__tests__/helpers/fixtures';

describe.skipIf(!hasTestDb)('institution-analytics rbac', () => {
  const app = createTestApp();

  beforeAll(async () => {
    await connectTestDb();
    await ensureTestInstitution();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  const institutionId = '000000000000000000000001';

  describe('INSTITUTION and ADMIN can access analytics endpoints', () => {
    it('INSTITUTION can GET /institution/dashboard/stats', async () => {
      const inst = await createUserAndLogin(app, 'INSTITUTION', { email: 'inst-stats@t.demo' });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/stats?institutionId=${institutionId}`)
        .set('Cookie', inst.cookie);
      expect(res.status).toBe(200);
    });

    it('ADMIN can GET /institution/dashboard/stats', async () => {
      const admin = await createUserAndLogin(app, 'ADMIN', { email: 'admin-stats@t.demo' });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/stats?institutionId=${institutionId}`)
        .set('Cookie', admin.cookie);
      expect(res.status).toBe(200);
    });

    it('INSTITUTION can GET /institution/dashboard/skill-gaps', async () => {
      const inst = await createUserAndLogin(app, 'INSTITUTION', { email: 'inst-skills@t.demo' });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/skill-gaps?institutionId=${institutionId}`)
        .set('Cookie', inst.cookie);
      expect(res.status).toBe(200);
    });

    it('INSTITUTION can GET /institution/dashboard/placement-metrics', async () => {
      const inst = await createUserAndLogin(app, 'INSTITUTION', {
        email: 'inst-placements@t.demo',
      });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/placement-metrics?institutionId=${institutionId}`)
        .set('Cookie', inst.cookie);
      expect(res.status).toBe(200);
    });

    it('INSTITUTION can GET /institution/dashboard/fdp-participation', async () => {
      const inst = await createUserAndLogin(app, 'INSTITUTION', { email: 'inst-fdp@t.demo' });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/fdp-participation?institutionId=${institutionId}`)
        .set('Cookie', inst.cookie);
      expect(res.status).toBe(200);
    });

    it('INSTITUTION can GET /institution/dashboard/students', async () => {
      const inst = await createUserAndLogin(app, 'INSTITUTION', { email: 'inst-students@t.demo' });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/students?institutionId=${institutionId}`)
        .set('Cookie', inst.cookie);
      expect(res.status).toBe(200);
    });

    it('INSTITUTION can GET /institution/dashboard/faculty', async () => {
      const inst = await createUserAndLogin(app, 'INSTITUTION', { email: 'inst-faculty@t.demo' });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/faculty?institutionId=${institutionId}`)
        .set('Cookie', inst.cookie);
      expect(res.status).toBe(200);
    });

    it('INSTITUTION can GET /institution/dashboard/stats with filters', async () => {
      const inst = await createUserAndLogin(app, 'INSTITUTION', { email: 'inst-filter@t.demo' });
      const res = await request(app)
        .get(
          `/api/v1/institution/dashboard/stats?institutionId=${institutionId}&department=Computer+Science&opportunityType=JOB&applicationStatus=APPLIED`,
        )
        .set('Cookie', inst.cookie);
      expect(res.status).toBe(200);
    });
  });

  describe('STUDENT, COMPANY, FACULTY are rejected from institution analytics', () => {
    it('STUDENT gets 403 on GET /institution/dashboard/stats', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'st-inst@t.demo' });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/stats?institutionId=${institutionId}`)
        .set('Cookie', student.cookie);
      expect(res.status).toBe(403);
    });

    it('COMPANY gets 403 on GET /institution/dashboard/stats', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'co-inst@t.demo',
        companyName: 'Co Inst Analytics',
      });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/stats?institutionId=${institutionId}`)
        .set('Cookie', company.cookie);
      expect(res.status).toBe(403);
    });

    it('FACULTY gets 403 on GET /institution/dashboard/stats', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'fac-inst@t.demo' });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/stats?institutionId=${institutionId}`)
        .set('Cookie', faculty.cookie);
      expect(res.status).toBe(403);
    });

    it('STUDENT gets 403 on GET /institution/dashboard/skill-gaps', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'st-skills@t.demo' });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/skill-gaps?institutionId=${institutionId}`)
        .set('Cookie', student.cookie);
      expect(res.status).toBe(403);
    });

    it('STUDENT gets 403 on GET /institution/dashboard/placement-metrics', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'st-placements@t.demo' });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/placement-metrics?institutionId=${institutionId}`)
        .set('Cookie', student.cookie);
      expect(res.status).toBe(403);
    });

    it('STUDENT gets 403 on GET /institution/dashboard/students', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'st-stud@t.demo' });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/students?institutionId=${institutionId}`)
        .set('Cookie', student.cookie);
      expect(res.status).toBe(403);
    });

    it('STUDENT gets 403 on GET /institution/dashboard/faculty', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'st-fac@t.demo' });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/faculty?institutionId=${institutionId}`)
        .set('Cookie', student.cookie);
      expect(res.status).toBe(403);
    });
  });

  describe('unauthenticated requests are rejected', () => {
    it('GET /institution/dashboard/stats without auth returns 401', async () => {
      const res = await request(app).get(
        `/api/v1/institution/dashboard/stats?institutionId=${institutionId}`,
      );
      expect(res.status).toBe(401);
    });

    it('GET /institution/dashboard/students without auth returns 401', async () => {
      const res = await request(app).get(
        `/api/v1/institution/dashboard/students?institutionId=${institutionId}`,
      );
      expect(res.status).toBe(401);
    });

    it('GET /institution/dashboard/skill-gaps without auth returns 401', async () => {
      const res = await request(app).get(
        `/api/v1/institution/dashboard/skill-gaps?institutionId=${institutionId}`,
      );
      expect(res.status).toBe(401);
    });
  });
});
