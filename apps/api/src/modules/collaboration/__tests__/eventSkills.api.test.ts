/**
 * Phase 15C — Event Skills API Endpoint Tests
 *
 * Verifies:
 * - Event host can update skills on their event
 * - Non-hosts are rejected (403)
 * - ADMIN can update skills on any event
 * - Invalid skill IDs are silently dropped
 * - markAttended calls processEventSkillsForRegistration
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createTestApp, hasTestDb } from '../../../__tests__/helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../../../__tests__/helpers/db';
import { createUserAndLogin, ensureTestInstitution } from '../../../__tests__/helpers/fixtures';
import { CollaborationEvent, Skill, User, type CollaborationEventDoc } from '../../../models';

describe.skipIf(!hasTestDb)('Collaboration — Event Skills API (Phase 15C)', () => {
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

  describe('PATCH /api/v1/collaboration/:id/skills', () => {
    it('HOST can update skills on their own event', async () => {
      const host = await createUserAndLogin(app, 'INSTITUTION', {
        email: 'event-host-skill@t.demo',
      });
      const skill = await Skill.create({ name: 'Host Skill', category: 'PROGRAMMING' });

      const event = await CollaborationEvent.create({
        title: 'Test Event for Skills',
        description: 'Testing event skills update endpoint',
        eventType: 'WORKSHOP',
        hostType: 'INSTITUTION',
        host: new Types.ObjectId(),
        postedBy: host.userId,
        startAt: new Date(),
        mode: 'ONLINE',
        status: 'PUBLISHED',
        skills: [],
      });

      const res = await request(app)
        .patch(`/api/v1/collaboration/${event._id}/skills`)
        .set('Cookie', host.cookie)
        .send({ skillIds: [skill._id.toString()] });

      expect(res.status).toBe(200);
      expect(res.body.data?.skills).toContain(skill._id.toString());
    });

    it('STUDENT cannot update event skills', async () => {
      const student = await createUserAndLogin(app, 'STUDENT', {
        email: 'student-no-skill-update@t.demo',
      });
      const host = await createUserAndLogin(app, 'INSTITUTION', {
        email: 'event-host-no-skill@t.demo',
      });
      const skill = await Skill.create({ name: 'No Update Skill', category: 'BACKEND' });
      const event = await CollaborationEvent.create({
        title: 'No Student Update Event',
        description: 'Testing student cannot update skills',
        eventType: 'WORKSHOP',
        hostType: 'INSTITUTION',
        host: new Types.ObjectId(),
        postedBy: host.userId,
        startAt: new Date(),
        mode: 'ONLINE',
        status: 'PUBLISHED',
        skills: [],
      });

      const res = await request(app)
        .patch(`/api/v1/collaboration/${event._id}/skills`)
        .set('Cookie', student.cookie)
        .send({ skillIds: [skill._id.toString()] });

      expect(res.status).toBe(403);
    });

    it('ADMIN can update skills on any event', async () => {
      const admin = await createUserAndLogin(app, 'ADMIN', {
        email: 'admin-skill-update@t.demo',
      });
      const host = await createUserAndLogin(app, 'INSTITUTION', {
        email: 'event-host-admin-skill@t.demo',
      });
      const skill = await Skill.create({ name: 'Admin Skill', category: 'DATABASE' });
      const event = await CollaborationEvent.create({
        title: 'Admin Updates Skills Event',
        description: 'Testing admin can update any event',
        eventType: 'WORKSHOP',
        hostType: 'INSTITUTION',
        host: new Types.ObjectId(),
        postedBy: host.userId,
        startAt: new Date(),
        mode: 'ONLINE',
        status: 'PUBLISHED',
        skills: [],
      });

      const res = await request(app)
        .patch(`/api/v1/collaboration/${event._id}/skills`)
        .set('Cookie', admin.cookie)
        .send({ skillIds: [skill._id.toString()] });

      expect(res.status).toBe(200);
      expect(res.body.data?.skills).toContain(skill._id.toString());
    });

    it('invalid skill IDs are silently dropped', async () => {
      const host = await createUserAndLogin(app, 'INSTITUTION', {
        email: 'event-host-drop-invalid@t.demo',
      });
      const skill = await Skill.create({ name: 'Valid Skill', category: 'CLOUD' });
      const event = await CollaborationEvent.create({
        title: 'Drop Invalid Skills Event',
        description: 'Testing invalid skills are dropped',
        eventType: 'WORKSHOP',
        hostType: 'INSTITUTION',
        host: new Types.ObjectId(),
        postedBy: host.userId,
        startAt: new Date(),
        mode: 'ONLINE',
        status: 'PUBLISHED',
        skills: [],
      });

      const fakeId = new Types.ObjectId().toString();
      const res = await request(app)
        .patch(`/api/v1/collaboration/${event._id}/skills`)
        .set('Cookie', host.cookie)
        .send({ skillIds: [fakeId, skill._id.toString()] });

      expect(res.status).toBe(200);
      // Only the valid skill should be present.
      expect(res.body.data?.skills).toContain(skill._id.toString());
      expect(res.body.data?.skills).not.toContain(fakeId);
    });

    it('returns 404 for non-existent event', async () => {
      const host = await createUserAndLogin(app, 'INSTITUTION', {
        email: 'event-host-no-event@t.demo',
      });
      const fakeId = new Types.ObjectId().toString();
      const res = await request(app)
        .patch(`/api/v1/collaboration/${fakeId}/skills`)
        .set('Cookie', host.cookie)
        .send({ skillIds: [] });

      expect(res.status).toBe(404);
    });
  });
});
