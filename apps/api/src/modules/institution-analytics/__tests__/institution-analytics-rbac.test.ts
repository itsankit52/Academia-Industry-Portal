import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, hasTestDb } from '../../../__tests__/helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../../../__tests__/helpers/db';
import { createUserAndLogin, ensureTestInstitution } from '../../../__tests__/helpers/fixtures';
import { Institution } from '../../../models';

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

  /**
   * SIH Phase 12 §9 — multi-institution isolation. An INSTITUTION user must
   * NEVER reach another institution's data, even if the request carries
   * `?institutionId=<other-id>`. The previous implementation of
   * `resolveInstitutionId` accepted that query parameter unconditionally for
   * non-admins, which made institution A able to read institution B by
   * changing the URL.
   */
  describe('INSTITUTION isolation — a second institution cannot be queried', () => {
    const otherInstitutionId = '000000000000000000000099';

    it('rejects when an INSTITUTION user passes another institutionId', async () => {
      const inst = await createUserAndLogin(app, 'INSTITUTION', { email: 'inst-cross@t.demo' });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/stats?institutionId=${otherInstitutionId}`)
        .set('Cookie', inst.cookie);
      expect(res.status).toBe(403);
    });

    it('rejects on a different endpoint too — placement-metrics', async () => {
      const inst = await createUserAndLogin(app, 'INSTITUTION', {
        email: 'inst-cross-pm@t.demo',
      });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/placement-metrics?institutionId=${otherInstitutionId}`)
        .set('Cookie', inst.cookie);
      expect(res.status).toBe(403);
    });

    it('still allows an INSTITUTION user to read their own institution', async () => {
      // The fixture makes an Institution for the INSTITUTION user. Read its id
      // from the DB and use it as the query — that must succeed.
      const inst = await createUserAndLogin(app, 'INSTITUTION', { email: 'inst-own@t.demo' });
      const user = await (
        await import('../../../models')
      ).User.findById(inst.userId)
        .select('institution')
        .lean();
      const ownId = String(user?.institution);
      expect(ownId).toBeTruthy();
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/stats?institutionId=${ownId}`)
        .set('Cookie', inst.cookie);
      expect(res.status).toBe(200);
    });

    it('ADMIN is still allowed to scope to any institution', async () => {
      // ADMIN is the one role that must keep the override — they are the
      // platform operator and need to inspect any institution on demand.
      const admin = await createUserAndLogin(app, 'ADMIN', { email: 'admin-cross@t.demo' });
      const res = await request(app)
        .get(`/api/v1/institution/dashboard/stats?institutionId=${otherInstitutionId}`)
        .set('Cookie', admin.cookie);
      expect(res.status).toBe(200);
    });
  });
});
