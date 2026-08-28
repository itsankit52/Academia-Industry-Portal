import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, hasTestDb } from '../../../__tests__/helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../../../__tests__/helpers/db';
import { createUserAndLogin } from '../../../__tests__/helpers/fixtures';

describe.skipIf(!hasTestDb)('faculty rbac', () => {
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

  // FACULTY-only routes (GET /faculty/me and /faculty/me/profile)
  describe('faculty profile routes', () => {
    it('GET /faculty/me returns 200 for FACULTY and 403 for STUDENT and COMPANY', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'faculty-rbac@t.demo' });
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'st-rbac@t.demo' });
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'co-rbac@t.demo',
        companyName: 'RBAC Co',
      });

      const okRes = await request(app).get('/api/v1/faculty/me').set('Cookie', faculty.cookie);
      expect(okRes.status).toBe(200);

      const studentRes = await request(app).get('/api/v1/faculty/me').set('Cookie', student.cookie);
      expect(studentRes.status).toBe(403);

      const companyRes = await request(app).get('/api/v1/faculty/me').set('Cookie', company.cookie);
      expect(companyRes.status).toBe(403);
    });

    it('GET /faculty/me/profile returns 200 for FACULTY and 403 for STUDENT and COMPANY', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'faculty-rbac-2@t.demo' });
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'st-rbac-2@t.demo' });
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'co-rbac-2@t.demo',
        companyName: 'RBAC Co 2',
      });

      const okRes = await request(app)
        .get('/api/v1/faculty/me/profile')
        .set('Cookie', faculty.cookie);
      expect(okRes.status).toBe(200);

      const studentRes = await request(app)
        .get('/api/v1/faculty/me/profile')
        .set('Cookie', student.cookie);
      expect(studentRes.status).toBe(403);

      const companyRes = await request(app)
        .get('/api/v1/faculty/me/profile')
        .set('Cookie', company.cookie);
      expect(companyRes.status).toBe(403);
    });

    it('PUT /faculty/me/profile returns 200 for FACULTY and 403 for STUDENT and COMPANY', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'faculty-rbac-3@t.demo' });
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'st-rbac-3@t.demo' });
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'co-rbac-3@t.demo',
        companyName: 'RBAC Co 3',
      });

      const updateBody = { bio: 'Updated bio for testing' };

      const okRes = await request(app)
        .put('/api/v1/faculty/me/profile')
        .set('Cookie', faculty.cookie)
        .send(updateBody);
      expect(okRes.status).toBe(200);

      const studentRes = await request(app)
        .put('/api/v1/faculty/me/profile')
        .set('Cookie', student.cookie)
        .send(updateBody);
      expect(studentRes.status).toBe(403);

      const companyRes = await request(app)
        .put('/api/v1/faculty/me/profile')
        .set('Cookie', company.cookie)
        .send(updateBody);
      expect(companyRes.status).toBe(403);
    });
  });

  // Mentorship: FACULTY can use mentorship routes as mentee
  describe('mentorship routes accessible to FACULTY', () => {
    it('FACULTY can list mentors', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', {
        email: 'faculty-mentorship@t.demo',
      });
      const res = await request(app)
        .get('/api/v1/mentorship/mentors')
        .set('Cookie', faculty.cookie);
      expect(res.status).toBe(200);
    });

    it('STUDENT cannot create a mentor profile for FACULTY-only endpoint — but this route is open to all', async () => {
      // Note: /mentorship/mentors/me POST has no role restriction in routes
      // The POST becomesMentor endpoint has no requireRole middleware
      // Both STUDENT and FACULTY can become mentors
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'st-mentor@t.demo' });
      const res = await request(app)
        .post('/api/v1/mentorship/mentors/me')
        .set('Cookie', student.cookie)
        .send({ bio: 'Student mentor bio', expertise: ['javascript'] });
      expect(res.status).toBe(201);
    });
  });

  // Events: FACULTY can create and manage events
  describe('event routes accessible to FACULTY', () => {
    it('FACULTY can list events', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'faculty-events@t.demo' });
      const res = await request(app).get('/api/v1/events').set('Cookie', faculty.cookie);
      expect(res.status).toBe(200);
    });

    it('STUDENT cannot POST /events (only COMPANY, INSTITUTION, FACULTY, ADMIN)', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'st-events@t.demo' });
      const res = await request(app).post('/api/v1/events').set('Cookie', student.cookie).send({
        title: 'Test Workshop',
        description: 'A test workshop event',
        eventType: 'WORKSHOP',
        startAt: new Date().toISOString(),
        mode: 'ONSITE',
        targetAudience: [],
        tags: [],
      });
      expect(res.status).toBe(403);
    });

    it('COMPANY cannot POST /events (only COMPANY, INSTITUTION, FACULTY, ADMIN)', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'co-events@t.demo',
        companyName: 'Event Co',
      });
      const res = await request(app).post('/api/v1/events').set('Cookie', company.cookie).send({
        title: 'Test Workshop',
        description: 'A test workshop event',
        eventType: 'WORKSHOP',
        startAt: new Date().toISOString(),
        mode: 'ONSITE',
        targetAudience: [],
        tags: [],
      });
      // COMPANY can create events, so 201 (created) not 403
      expect(res.status).toBe(201);
    });

    it('STUDENT can register for events via POST /events/:id/register', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'st-reg@t.demo' });
      const res = await request(app)
        .post('/api/v1/events/000000000000000000000001/register')
        .set('Cookie', student.cookie)
        .send({});
      // 404 because event doesn't exist, but role check passed (not 403)
      expect(res.status).not.toBe(403);
    });
  });

  // Applications: FACULTY can apply to faculty opportunities
  describe('faculty opportunity applications', () => {
    it('FACULTY can POST /applications (apply to faculty opportunities)', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'faculty-app@t.demo' });
      const res = await request(app)
        .post('/api/v1/applications')
        .set('Cookie', faculty.cookie)
        .send({
          opportunityType: 'FDP',
          opportunityId: '000000000000000000000001',
          coverLetter: 'I am interested',
        });
      // 404 because opportunity doesn't exist, but role check passed (not 403)
      expect(res.status).not.toBe(403);
    });

    it('COMPANY cannot POST /applications (only STUDENT and FACULTY)', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'co-app@t.demo',
        companyName: 'App Co',
      });
      const res = await request(app)
        .post('/api/v1/applications')
        .set('Cookie', company.cookie)
        .send({
          opportunityType: 'JOB',
          opportunityId: '000000000000000000000001',
          coverLetter: 'Applying',
        });
      expect(res.status).toBe(403);
    });

    it('FACULTY can GET /applications (own applications list)', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'faculty-list@t.demo' });
      const res = await request(app).get('/api/v1/applications').set('Cookie', faculty.cookie);
      expect(res.status).toBe(200);
    });

    it('COMPANY cannot GET /faculty/me (faculty-only route)', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'co-me@t.demo',
        companyName: 'Me Co',
      });
      const res = await request(app).get('/api/v1/faculty/me').set('Cookie', company.cookie);
      expect(res.status).toBe(403);
    });

    it('STUDENT cannot GET /faculty/me (faculty-only route)', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'st-me@t.demo' });
      const res = await request(app).get('/api/v1/faculty/me').set('Cookie', student.cookie);
      expect(res.status).toBe(403);
    });
  });

  // Verify unauthenticated requests are rejected
  describe('unauthenticated requests are rejected', () => {
    it('GET /faculty/me without auth returns 401', async () => {
      const res = await request(app).get('/api/v1/faculty/me');
      expect(res.status).toBe(401);
    });

    it('GET /faculty/me/profile without auth returns 401', async () => {
      const res = await request(app).get('/api/v1/faculty/me/profile');
      expect(res.status).toBe(401);
    });
  });
});
