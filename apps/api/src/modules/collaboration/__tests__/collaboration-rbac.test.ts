import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, hasTestDb } from '../../../__tests__/helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../../../__tests__/helpers/db';
import { createUserAndLogin } from '../../../__tests__/helpers/fixtures';

describe.skipIf(!hasTestDb)('collaboration events RBAC', () => {
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

  const validEventPayload = {
    title: 'Test Workshop on AI',
    description:
      'A comprehensive workshop on artificial intelligence and machine learning techniques for beginners and intermediate developers looking to expand their skills.',
    eventType: 'WORKSHOP',
    startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    mode: 'ONLINE',
    targetAudience: [],
    tags: ['AI', 'ML'],
  };

  describe('POST /events — event creation', () => {
    it('COMPANY can create an event', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'collab-co@t.demo',
        companyName: 'Collab Co',
      });
      const res = await request(app)
        .post('/api/v1/events')
        .set('Cookie', company.cookie)
        .send(validEventPayload);
      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe(validEventPayload.title);
    });

    it('FACULTY can create an event', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', {
        email: 'collab-fac@t.demo',
        fullName: 'Dr. Test Faculty',
      });
      const res = await request(app)
        .post('/api/v1/events')
        .set('Cookie', faculty.cookie)
        .send(validEventPayload);
      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe(validEventPayload.title);
    });

    it('STUDENT cannot create an event', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'collab-st@t.demo' });
      const res = await request(app)
        .post('/api/v1/events')
        .set('Cookie', student.cookie)
        .send(validEventPayload);
      expect(res.status).toBe(403);
    });

    it('unauthenticated request cannot create an event', async () => {
      const res = await request(app).post('/api/v1/events').send(validEventPayload);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /events — event listing', () => {
    it('STUDENT can list published events', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'list-st@t.demo' });
      const res = await request(app).get('/api/v1/events').set('Cookie', student.cookie);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total');
    });

    it('unauthenticated request can list published events', async () => {
      const res = await request(app).get('/api/v1/events');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
    });

    it('filters by eventType', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'filter-st@t.demo' });
      const res = await request(app)
        .get('/api/v1/events?eventType=WORKSHOP')
        .set('Cookie', student.cookie);
      expect(res.status).toBe(200);
      for (const ev of res.body.data.items) {
        expect(ev.eventType).toBe('WORKSHOP');
      }
    });
  });

  describe('GET /events/mine/registrations — my registrations', () => {
    it('STUDENT can list their registrations', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'reg-st@t.demo' });
      const res = await request(app)
        .get('/api/v1/events/mine/registrations')
        .set('Cookie', student.cookie);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
    });

    it('unauthenticated request cannot list registrations', async () => {
      const res = await request(app).get('/api/v1/events/mine/registrations');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /events/:id/register — event registration', () => {
    it('STUDENT can register for a published event', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'reg-co@t.demo',
        companyName: 'Reg Co',
      });
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'reg-st2@t.demo' });

      // Create and publish an event
      const createRes = await request(app)
        .post('/api/v1/events')
        .set('Cookie', company.cookie)
        .send({ ...validEventPayload, targetAudience: ['STUDENT'] });
      const eventId = createRes.body.data.id;

      await request(app).post(`/api/v1/events/${eventId}/publish`).set('Cookie', company.cookie);

      // Student registers
      const regRes = await request(app)
        .post(`/api/v1/events/${eventId}/register`)
        .set('Cookie', student.cookie)
        .send({});
      expect(regRes.status).toBe(201);
    });

    it('unauthenticated cannot register', async () => {
      const res = await request(app)
        .post('/api/v1/events/000000000000000000000001/register')
        .send({});
      expect(res.status).toBe(401);
    });

    it('FACULTY can register for events', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'reg-co2@t.demo',
        companyName: 'Reg Co 2',
      });
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'reg-fac@t.demo' });

      const createRes = await request(app)
        .post('/api/v1/events')
        .set('Cookie', company.cookie)
        .send({ ...validEventPayload, targetAudience: ['FACULTY'] });
      const eventId = createRes.body.data.id;

      await request(app).post(`/api/v1/events/${eventId}/publish`).set('Cookie', company.cookie);

      const regRes = await request(app)
        .post(`/api/v1/events/${eventId}/register`)
        .set('Cookie', faculty.cookie)
        .send({});
      expect(regRes.status).toBe(201);
    });
  });

  describe('PATCH /events/:id — event update', () => {
    it('COMPANY can update their own event', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'upd-co@t.demo',
        companyName: 'Upd Co',
      });

      const createRes = await request(app)
        .post('/api/v1/events')
        .set('Cookie', company.cookie)
        .send(validEventPayload);
      const eventId = createRes.body.data.id;

      const updateRes = await request(app)
        .patch(`/api/v1/events/${eventId}`)
        .set('Cookie', company.cookie)
        .send({ title: 'Updated Workshop Title' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Updated Workshop Title');
    });

    it('FACULTY can update their own event', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'upd-fac@t.demo' });

      const createRes = await request(app)
        .post('/api/v1/events')
        .set('Cookie', faculty.cookie)
        .send(validEventPayload);
      const eventId = createRes.body.data.id;

      const updateRes = await request(app)
        .patch(`/api/v1/events/${eventId}`)
        .set('Cookie', faculty.cookie)
        .send({ title: 'Faculty Workshop Update' });
      expect(updateRes.status).toBe(200);
    });

    it('STUDENT cannot update an event', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'upd-st-co@t.demo',
        companyName: 'Upd St Co',
      });
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'upd-st@t.demo' });

      const createRes = await request(app)
        .post('/api/v1/events')
        .set('Cookie', company.cookie)
        .send(validEventPayload);
      const eventId = createRes.body.data.id;

      const updateRes = await request(app)
        .patch(`/api/v1/events/${eventId}`)
        .set('Cookie', student.cookie)
        .send({ title: 'Hacked Title' });
      expect(updateRes.status).toBe(403);
    });
  });

  describe('POST /events/:id/cancel', () => {
    it('COMPANY can cancel their own event', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'cancel-co@t.demo',
        companyName: 'Cancel Co',
      });

      const createRes = await request(app)
        .post('/api/v1/events')
        .set('Cookie', company.cookie)
        .send(validEventPayload);
      const eventId = createRes.body.data.id;

      const cancelRes = await request(app)
        .post(`/api/v1/events/${eventId}/cancel`)
        .set('Cookie', company.cookie);
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');
    });

    it('FACULTY can cancel their own event', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'cancel-fac@t.demo' });

      const createRes = await request(app)
        .post('/api/v1/events')
        .set('Cookie', faculty.cookie)
        .send(validEventPayload);
      const eventId = createRes.body.data.id;

      const cancelRes = await request(app)
        .post(`/api/v1/events/${eventId}/cancel`)
        .set('Cookie', faculty.cookie);
      expect(cancelRes.status).toBe(200);
    });

    it('STUDENT cannot cancel an event', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'cancel-st-co@t.demo',
        companyName: 'Cancel St Co',
      });
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'cancel-st@t.demo' });

      const createRes = await request(app)
        .post('/api/v1/events')
        .set('Cookie', company.cookie)
        .send(validEventPayload);
      const eventId = createRes.body.data.id;

      const cancelRes = await request(app)
        .post(`/api/v1/events/${eventId}/cancel`)
        .set('Cookie', student.cookie);
      expect(cancelRes.status).toBe(403);
    });
  });

  describe('DELETE /events/:id/register — unregister', () => {
    it('STUDENT can unregister from an event', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'unreg-co@t.demo',
        companyName: 'Unreg Co',
      });
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'unreg-st@t.demo' });

      const createRes = await request(app)
        .post('/api/v1/events')
        .set('Cookie', company.cookie)
        .send({ ...validEventPayload, targetAudience: ['STUDENT'] });
      const eventId = createRes.body.data.id;

      await request(app).post(`/api/v1/events/${eventId}/publish`).set('Cookie', company.cookie);

      await request(app)
        .post(`/api/v1/events/${eventId}/register`)
        .set('Cookie', student.cookie)
        .send({});

      const unregRes = await request(app)
        .delete(`/api/v1/events/${eventId}/register`)
        .set('Cookie', student.cookie);
      expect(unregRes.status).toBe(204);
    });
  });

  describe('mentorship RBAC', () => {
    it('STUDENT can list mentors', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', { email: 'mst-st@t.demo' });
      const res = await request(app)
        .get('/api/v1/mentorship/mentors')
        .set('Cookie', student.cookie);
      expect(res.status).toBe(200);
    });

    it('FACULTY can list mentors', async () => {
      const faculty = await createUserAndLogin(app, 'FACULTY', { email: 'mst-fac@t.demo' });
      const res = await request(app)
        .get('/api/v1/mentorship/mentors')
        .set('Cookie', faculty.cookie);
      expect(res.status).toBe(200);
    });

    it('COMPANY can list mentors', async () => {
      const company = await createUserAndLogin(app, 'COMPANY', {
        email: 'mst-co@t.demo',
        companyName: 'MST Co',
      });
      const res = await request(app)
        .get('/api/v1/mentorship/mentors')
        .set('Cookie', company.cookie);
      expect(res.status).toBe(200);
    });

    it('STUDENT can request mentorship', async () => {
      const mentor = await createUserAndLogin(app, 'COMPANY', {
        email: 'mentor@t.demo',
        companyName: 'Mentor Co',
      });
      // Create mentor profile
      await request(app)
        .post('/api/v1/mentorship/mentors/me')
        .set('Cookie', mentor.cookie)
        .send({ bio: 'Expert mentor', expertise: ['AI', 'ML'] });

      const student = await createUserAndLogin(app, 'STUDENT', { email: 'req-st@t.demo' });
      const res = await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Cookie', student.cookie)
        .send({
          mentorUserId: mentor.userId,
          initialMessage: 'I would like to learn from you.',
        });
      expect(res.status).toBe(201);
    });

    it('COMPANY cannot request mentorship', async () => {
      const mentor = await createUserAndLogin(app, 'COMPANY', {
        email: 'mentor2@t.demo',
        companyName: 'Mentor Co 2',
      });
      await request(app)
        .post('/api/v1/mentorship/mentors/me')
        .set('Cookie', mentor.cookie)
        .send({ bio: 'Expert mentor 2', expertise: ['AI'] });

      const company2 = await createUserAndLogin(app, 'COMPANY', {
        email: 'req-co@t.demo',
        companyName: 'Req Co',
      });
      const res = await request(app)
        .post('/api/v1/mentorship/requests')
        .set('Cookie', company2.cookie)
        .send({
          mentorUserId: mentor.userId,
          initialMessage: 'Company mentorship request.',
        });
      // Only STUDENT and FACULTY can request mentorship
      expect(res.status).toBe(403);
    });
  });
});
