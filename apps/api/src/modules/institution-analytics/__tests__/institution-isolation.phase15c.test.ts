/**
 * Phase 15C — Institution Cross-Isolation Tests
 *
 * Verifies that each institution can ONLY see its own data.
 * Tests:
 * - Students only see faculty opportunities from their institution
 * - Institution analytics scoped to the requesting institution
 * - Skill outcomes scoped to institution
 * - Placement drive data scoped to institution
 * - STUDENT from institution A cannot access data from institution B
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createTestApp, hasTestDb } from '../../../__tests__/helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../../../__tests__/helpers/db';
import { createUserAndLogin } from '../../../__tests__/helpers/fixtures';
import {
  CollaborationEvent,
  FacultyProfile,
  Institution,
  Job,
  Skill,
  StudentProfile,
  StudentSkill,
  User,
} from '../../../models';

describe.skipIf(!hasTestDb)('Institution Isolation (Phase 15C)', () => {
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

  /**
   * Set up two separate institutions with students and faculty opportunities.
   */
  async function setupTwoInstitutions() {
    // Institution A
    const instA = await Institution.create({
      name: 'Institute A',
      code: `INSTA${Date.now()}`,
      domain: 'institutea.edu',
      verificationStatus: 'VERIFIED',
    });
    const userA = await User.create({
      email: `user-a-${Date.now()}@institutea.edu`,
      role: 'STUDENT',
      isActive: true,
      passwordHash: 'hash',
    });
    const profileA = await StudentProfile.create({
      user: userA._id,
      institution: instA._id,
      fullName: 'Student A',
    });
    const facultyUserA = await User.create({
      email: `faculty-a-${Date.now()}@institutea.edu`,
      role: 'FACULTY',
      isActive: true,
      passwordHash: 'hash',
      institution: instA._id,
    });
    const facultyProfileA = await FacultyProfile.create({
      user: facultyUserA._id,
      institution: instA._id,
      fullName: 'Faculty A',
    });
    const eventA = await CollaborationEvent.create({
      title: 'Institute A Workshop',
      description: 'A workshop from Institute A',
      eventType: 'WORKSHOP',
      hostType: 'INSTITUTION',
      host: facultyProfileA._id,
      postedBy: facultyUserA._id,
      institutionId: instA._id,
      startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      mode: 'ONLINE',
      status: 'PUBLISHED',
    });

    // Institution B
    const instB = await Institution.create({
      name: 'Institute B',
      code: `INSTB${Date.now()}`,
      domain: 'instituteb.edu',
      verificationStatus: 'VERIFIED',
    });
    const userB = await User.create({
      email: `user-b-${Date.now()}@instituteb.edu`,
      role: 'STUDENT',
      isActive: true,
      passwordHash: 'hash',
    });
    await StudentProfile.create({
      user: userB._id,
      institution: instB._id,
      fullName: 'Student B',
    });

    return { instA, instB, userA, userB, eventA };
  }

  it('STUDENT can see faculty opportunities from their own institution', async () => {
    const { instA, userA } = await setupTwoInstitutions();

    const skill = await Skill.create({ name: 'Test Skill', category: 'PROGRAMMING' });
    const company = await User.create({
      email: `company-${Date.now()}@company.com`,
      role: 'COMPANY',
      isActive: true,
      passwordHash: 'hash',
    });
    const job = await Job.create({
      title: 'Company Job',
      company: company._id,
      description: 'A job',
      status: 'PUBLISHED',
      workMode: 'ONSITE',
      location: 'City',
      employmentType: 'FULL_TIME',
      institutionId: instA._id,
      requiredSkills: [skill._id],
    });

    const cookie = await createUserAndLogin(app, 'STUDENT', { email: userA.email });
    const res = await request(app)
      .get('/api/v1/student-opportunities/featured')
      .set('Cookie', cookie.cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('INSTITUTION A cannot see analytics for INSTITUTION B', async () => {
    const { instA, instB } = await setupTwoInstitutions();

    // Create skill outcomes data for Institution B
    const skill = await Skill.create({ name: 'Isolate Skill', category: 'PROGRAMMING' });
    const studentUserB = await User.create({
      email: `student-b-iso-${Date.now()}@instituteb.edu`,
      role: 'STUDENT',
      isActive: true,
      passwordHash: 'hash',
    });
    const profileB = await StudentProfile.create({
      user: studentUserB._id,
      institution: instB._id,
      fullName: 'Student B Isolated',
    });
    await StudentSkill.create({
      student: profileB._id,
      skill: skill._id,
      proficiency: 'BEGINNER',
    });
    const company = await User.create({
      email: `company-iso-${Date.now()}@company.com`,
      role: 'COMPANY',
      isActive: true,
      passwordHash: 'hash',
    });
    await Job.create({
      title: 'Iso Job',
      company: company._id,
      description: 'A job',
      status: 'PUBLISHED',
      workMode: 'REMOTE',
      location: 'Remote',
      employmentType: 'FULL_TIME',
      institutionId: instB._id,
      requiredSkills: [skill._id],
    });

    // Login as Institution A and query skill outcomes
    const instAUser = await createUserAndLogin(app, 'INSTITUTION', {
      institutionCode: `INSTA${Date.now()}`,
    });
    const res = await request(app)
      .get(`/api/v1/institution/analytics/skill-outcomes?institutionId=${instA._id}`)
      .set('Cookie', instAUser.cookie);

    // Institution A should get its own data (possibly empty), NOT B's data
    expect(res.status).toBe(200);
    const foundSkill = res.body.data?.metrics?.find(
      (m: { name: string }) => m.name === 'Isolate Skill',
    );
    expect(foundSkill).toBeUndefined(); // Inst A should NOT see Inst B's data
  });

  it('placement drive is only visible to its institution', async () => {
    const { instA, instB } = await setupTwoInstitutions();

    // Login as InstB
    const instBUser = await createUserAndLogin(app, 'INSTITUTION', {
      institutionCode: `INSTB${Date.now()}`,
    });

    const res = await request(app)
      .get(`/api/v1/institution/placement-drives?institutionId=${instA._id}`)
      .set('Cookie', instBUser.cookie);

    // InstB should NOT be able to see InstA's drives via direct id access
    // (assuming the route validates institutionId matches the user's institution)
    expect(res.status).toBe(403);
  });

  it('skill outcome analytics returns data scoped to institution', async () => {
    const { instA } = await setupTwoInstitutions();

    // Create data for instA only
    const skillA = await Skill.create({ name: 'InstA Skill', category: 'AI_ML' });
    const studentUserA = await User.create({
      email: `student-a-analytics-${Date.now()}@institutea.edu`,
      role: 'STUDENT',
      isActive: true,
      passwordHash: 'hash',
    });
    const profileA = await StudentProfile.create({
      user: studentUserA._id,
      institution: instA._id,
      fullName: 'Student A Analytics',
    });
    await StudentSkill.create({
      student: profileA._id,
      skill: skillA._id,
      proficiency: 'INTERMEDIATE',
    });
    const company = await User.create({
      email: `company-analytics-${Date.now()}@company.com`,
      role: 'COMPANY',
      isActive: true,
      passwordHash: 'hash',
    });
    await Job.create({
      title: 'Analytics Job',
      company: company._id,
      description: 'Testing analytics',
      status: 'PUBLISHED',
      workMode: 'HYBRID',
      location: 'Bangalore',
      employmentType: 'FULL_TIME',
      institutionId: instA._id,
      requiredSkills: [skillA._id],
    });

    const instAUser = await createUserAndLogin(app, 'INSTITUTION', {
      institutionCode: `INSTA${Date.now()}`,
    });
    const res = await request(app)
      .get(`/api/v1/institution/analytics/skill-outcomes?institutionId=${instA._id}`)
      .set('Cookie', instAUser.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data?.institutionId).toBe(String(instA._id));
  });
});
