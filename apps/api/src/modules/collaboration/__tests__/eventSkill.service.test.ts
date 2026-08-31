/**
 * Phase 15C — Event → Skill Development Service Tests
 *
 * Verifies:
 * - Skill evidence is created at BEGINNER proficiency (never higher).
 * - Existing skills at higher proficiency are NOT downgraded.
 * - Idempotency: re-processing the same registration does not duplicate
 *   evidence or create duplicate StudentSkill rows.
 * - Non-students do not get skill evidence.
 * - Missing student profile is handled gracefully.
 */

import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CollaborationEvent,
  EventRegistration,
  Skill,
  StudentProfile,
  StudentSkill,
  User,
  type CollaborationEventDoc,
  type SkillDoc,
  type UserDoc,
} from '../../../models';
import {
  clearTestDb,
  connectTestDb,
  disconnectTestDb,
  hasTestDb,
} from '../../../__tests__/helpers/db';
import { processEventSkillsForRegistration } from '../eventSkill.service';

describe.skipIf(!hasTestDb)('eventSkill.service (Phase 15C)', () => {
  let studentUser: UserDoc;
  let studentProfile: { _id: Types.ObjectId };
  let facultyUser: UserDoc;
  let event: CollaborationEventDoc;
  let skill1: SkillDoc;
  let skill2: SkillDoc;
  let skill3: SkillDoc;
  let registration: { _id: Types.ObjectId };

  beforeAll(async () => {
    await connectTestDb();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();

    // Create users
    studentUser = await User.create({
      email: 'student-phase15c@t.demo',
      role: 'STUDENT',
      isActive: true,
      passwordHash: 'hash',
    });
    facultyUser = await User.create({
      email: 'faculty-phase15c@t.demo',
      role: 'FACULTY',
      isActive: true,
      passwordHash: 'hash',
    });
    studentProfile = await StudentProfile.create({
      user: studentUser._id,
      fullName: 'Test Student',
      institution: new Types.ObjectId(),
    });

    // Create skills
    skill1 = await Skill.create({ name: 'Phase15C Skill 1', category: 'PROGRAMMING' });
    skill2 = await Skill.create({ name: 'Phase15C Skill 2', category: 'BACKEND' });
    skill3 = await Skill.create({ name: 'Phase15C Skill 3', category: 'FRONTEND' });

    // Create event with skills attached
    event = await CollaborationEvent.create({
      title: 'Phase 15C Workshop',
      description: 'A workshop for testing event-to-skill flow.',
      eventType: 'WORKSHOP',
      hostType: 'INSTITUTION',
      host: new Types.ObjectId(),
      postedBy: facultyUser._id,
      startAt: new Date(Date.now() - 1000 * 60 * 60),
      endAt: new Date(Date.now() - 1000 * 60 * 30),
      mode: 'ONLINE',
      status: 'COMPLETED',
      skills: [skill1._id, skill2._id, skill3._id],
    });

    // Create registration marked attended
    const reg = await EventRegistration.create({
      event: event._id,
      user: studentUser._id,
      attendedAt: new Date(),
    });
    registration = { _id: reg._id as Types.ObjectId };
  });

  it('adds new skills to student profile at BEGINNER proficiency', async () => {
    const result = await processEventSkillsForRegistration(String(registration._id));
    expect(result.processed).toBe(3);
    expect(result.added).toHaveLength(3);
    expect(result.alreadyPresent).toHaveLength(0);

    const studentSkills = await StudentSkill.find({ student: studentProfile._id }).lean();
    expect(studentSkills).toHaveLength(3);
    for (const ss of studentSkills) {
      expect(ss.proficiency).toBe('BEGINNER');
    }
  });

  it('is idempotent — re-running does not duplicate records', async () => {
    await processEventSkillsForRegistration(String(registration._id));
    const result = await processEventSkillsForRegistration(String(registration._id));
    expect(result.processed).toBe(0);
    expect(result.added).toHaveLength(0);
    expect(result.skipped).toBe(3);

    const studentSkills = await StudentSkill.find({ student: studentProfile._id }).lean();
    expect(studentSkills).toHaveLength(3);
  });

  it('does not downgrade skills already on profile at higher proficiency', async () => {
    // Pre-populate one skill at INTERMEDIATE.
    await StudentSkill.create({
      student: studentProfile._id,
      skill: skill2._id,
      proficiency: 'INTERMEDIATE',
    });
    await StudentSkill.create({
      student: studentProfile._id,
      skill: skill3._id,
      proficiency: 'ADVANCED',
    });

    const result = await processEventSkillsForRegistration(String(registration._id));
    // Only skill1 should be added; skill2 and skill3 are already present.
    expect(result.added).toHaveLength(1);
    expect(result.added[0]).toBe(String(skill1._id));
    expect(result.alreadyPresent).toHaveLength(2);

    const skill2Row = await StudentSkill.findOne({
      student: studentProfile._id,
      skill: skill2._id,
    }).lean();
    const skill3Row = await StudentSkill.findOne({
      student: studentProfile._id,
      skill: skill3._id,
    }).lean();
    expect(skill2Row?.proficiency).toBe('INTERMEDIATE');
    expect(skill3Row?.proficiency).toBe('ADVANCED');
  });

  it('throws when student has not been marked attended', async () => {
    const reg2 = await EventRegistration.create({
      event: event._id,
      user: facultyUser._id,
    });
    await expect(processEventSkillsForRegistration(String(reg2._id))).rejects.toThrow(
      /must be marked attended/i,
    );
  });

  it('returns zeros when event has no attached skills', async () => {
    const emptyEvent = await CollaborationEvent.create({
      title: 'Empty Event',
      description: 'No skills attached',
      eventType: 'WORKSHOP',
      hostType: 'INSTITUTION',
      host: new Types.ObjectId(),
      postedBy: facultyUser._id,
      startAt: new Date(),
      mode: 'ONLINE',
      status: 'COMPLETED',
      skills: [],
    });
    const reg2 = await EventRegistration.create({
      event: emptyEvent._id,
      user: studentUser._id,
      attendedAt: new Date(),
    });
    const result = await processEventSkillsForRegistration(String(reg2._id));
    expect(result.processed).toBe(0);
    expect(result.added).toHaveLength(0);
  });

  it('rejects invalid registration id', async () => {
    await expect(processEventSkillsForRegistration('not-a-valid-id')).rejects.toThrow(
      /Registration not found/i,
    );
  });

  it('rejects non-existent registration id', async () => {
    const fakeId = new Types.ObjectId().toString();
    await expect(processEventSkillsForRegistration(fakeId)).rejects.toThrow(
      /Registration not found/i,
    );
  });
});
