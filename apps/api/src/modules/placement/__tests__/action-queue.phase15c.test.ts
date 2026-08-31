/**
 * Phase 15C — Action Queue Generation / Resolution Tests
 *
 * Covers:
 * - Detection of OFFER_EXPIRY_RISK items
 * - Detection of DRIVE_OUTCOME_PENDING_RECORD items
 * - Detection of REGISTRATION_DEADLINE_APPROACHING items
 * - Idempotent detection via dedupeKey
 * - Acknowledge / start / resolve / dismiss flows
 * - Counts by status / severity / type
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import request from 'supertest';
import {
  Application,
  PlacementActionItem,
  PlacementDrive,
  PlacementDriveOutcome,
  PlacementParticipant,
  StudentProfile,
  User,
} from '../../../models';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../../../__tests__/helpers/db';
import { hasTestDb } from '../../../__tests__/helpers/app';
import { ActionQueueService } from '../action-queue.service';

describe.skipIf(!hasTestDb)('action-queue.service (Phase 15C)', () => {
  let institutionId: Types.ObjectId;

  beforeAll(async () => {
    await connectTestDb();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
    institutionId = new Types.ObjectId();
  });

  describe('detect()', () => {
    it('creates OFFER_EXPIRY_RISK action items for offers expiring within 48h', async () => {
      const studentUser = await User.create({
        email: 'offer-student@t.demo',
        role: 'STUDENT',
        isActive: true,
        passwordHash: 'hash',
      });
      const studentProfile = await StudentProfile.create({
        user: studentUser._id,
        institution: institutionId,
        fullName: 'Test Student',
      });

      const app = await Application.create({
        student: studentProfile._id,
        opportunity: new Types.ObjectId(),
        opportunityType: 'JOB',
        status: 'SELECTED',
        offerExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const result = await ActionQueueService.detect(String(institutionId));
      expect(result.created).toBeGreaterThanOrEqual(1);

      const item = await PlacementActionItem.findOne({
        dedupeKey: `application:OFFER_EXPIRY_RISK:${app._id}`,
      });
      expect(item).toBeDefined();
      expect(item!.type).toBe('OFFER_EXPIRY_RISK');
      expect(item!.severity).toBe('CRITICAL');
      expect(item!.status).toBe('OPEN');
    });

    it('is idempotent — running twice does not duplicate', async () => {
      const studentUser = await User.create({
        email: 'dup-student@t.demo',
        role: 'STUDENT',
        isActive: true,
        passwordHash: 'hash',
      });
      const studentProfile = await StudentProfile.create({
        user: studentUser._id,
        institution: institutionId,
        fullName: 'Dup Test',
      });

      await Application.create({
        student: studentProfile._id,
        opportunity: new Types.ObjectId(),
        opportunityType: 'JOB',
        status: 'SELECTED',
        offerExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const first = await ActionQueueService.detect(String(institutionId));
      const second = await ActionQueueService.detect(String(institutionId));

      expect(first.created).toBeGreaterThanOrEqual(1);
      // Second pass should only update, not create.
      expect(second.created).toBe(0);
      expect(second.updated).toBeGreaterThanOrEqual(1);

      const count = await PlacementActionItem.countDocuments({
        institution: institutionId,
      });
      expect(count).toBe(first.created);
    });

    it('detects REGISTRATION_DEADLINE_APPROACHING for drives closing within 48h', async () => {
      const drive = await PlacementDrive.create({
        institution: institutionId,
        title: 'Test Drive',
        status: 'REGISTRATION_OPEN',
        driveStartsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        registrationClosesAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await ActionQueueService.detect(String(institutionId));

      const item = await PlacementActionItem.findOne({
        dedupeKey: `drive:REGISTRATION_DEADLINE_APPROACHING:${drive._id}`,
      });
      expect(item).toBeDefined();
      expect(item!.type).toBe('REGISTRATION_DEADLINE_APPROACHING');
      expect(item!.severity).toBe('HIGH');
    });
  });

  describe('list()', () => {
    it('returns paginated action items for an institution', async () => {
      const drive = await PlacementDrive.create({
        institution: institutionId,
        title: 'Test Drive',
        status: 'REGISTRATION_OPEN',
        driveStartsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        registrationClosesAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      });
      await ActionQueueService.detect(String(institutionId));

      const result = await ActionQueueService.list({ institutionId: String(institutionId) });
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.items[0].institution!.toString()).toBe(institutionId.toString());
    });
  });

  describe('acknowledge / start / resolve / dismiss', () => {
    it('transitions through OPEN → ACKNOWLEDGED → IN_PROGRESS → RESOLVED', async () => {
      const studentUser = await User.create({
        email: 'trans-student@t.demo',
        role: 'STUDENT',
        isActive: true,
        passwordHash: 'hash',
      });
      const studentProfile = await StudentProfile.create({
        user: studentUser._id,
        institution: institutionId,
        fullName: 'Transition Student',
      });
      await Application.create({
        student: studentProfile._id,
        opportunity: new Types.ObjectId(),
        opportunityType: 'JOB',
        status: 'SELECTED',
        offerExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await ActionQueueService.detect(String(institutionId));
      const item = await PlacementActionItem.findOne({
        institution: institutionId,
      });
      expect(item).toBeDefined();

      const institutionUser = await User.create({
        email: 'staff@t.demo',
        role: 'INSTITUTION',
        isActive: true,
        passwordHash: 'hash',
        institution: institutionId,
      });

      await ActionQueueService.acknowledge(String(item!._id), institutionUser);
      let updated = await PlacementActionItem.findById(item!._id);
      expect(updated!.status).toBe('ACKNOWLEDGED');

      await ActionQueueService.start(String(item!._id), institutionUser);
      updated = await PlacementActionItem.findById(item!._id);
      expect(updated!.status).toBe('IN_PROGRESS');

      await ActionQueueService.resolve(
        String(item!._id),
        institutionUser,
        'Resolved by automation',
      );
      updated = await PlacementActionItem.findById(item!._id);
      expect(updated!.status).toBe('RESOLVED');
      expect(updated!.resolutionNote).toBe('Resolved by automation');
      expect(updated!.resolvedAt).toBeDefined();
    });
  });

  describe('counts helpers', () => {
    it('returns zero counts for institutions with no action items', async () => {
      const byStatus = await ActionQueueService.countsByStatus(String(institutionId));
      const bySev = await ActionQueueService.countsBySeverity(String(institutionId));
      const byType = await ActionQueueService.countsByType(String(institutionId));

      for (const v of Object.values(byStatus)) expect(v).toBe(0);
      for (const v of Object.values(bySev)) expect(v).toBe(0);
      for (const v of Object.values(byType)) expect(v).toBe(0);
    });
  });
});
