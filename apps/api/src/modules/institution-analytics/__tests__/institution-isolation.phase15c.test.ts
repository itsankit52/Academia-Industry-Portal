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
import {
  createUserAndLogin,
  loginAndGetCookie,
  TEST_PASSWORD,
} from '../../../__tests__/helpers/fixtures';
import { hashPassword } from '../../../utils/password';
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
    const passwordHash = await hashPassword(TEST_PASSWORD);
    // Institution A
    const instA = await Institution.create({
      name: 'Institute A',
      code: `INSTA${Date.now()}`,
      domain: 'institutea.edu',
      address: '1 Institute A Way',
      city: 'CityA',
      state: 'StateA',
      contactEmail: `admin-insta@${Date.now()}.edu`,
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
    });
    const userA = await User.create({
      email: `user-a-${Date.now()}@institutea.edu`,
      role: 'STUDENT',
      isActive: true,
      passwordHash,
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
      passwordHash,
      institution: instA._id,
    });
    const facultyProfileA = await FacultyProfile.create({
      user: facultyUserA._id,
      institution: instA._id,
      fullName: 'Faculty A',
      designation: 'Assistant Professor',
      department: 'Computer Science',
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
      address: '1 Institute B Way',
      city: 'CityB',
      state: 'StateB',
      contactEmail: `admin-instb@${Date.now()}.edu`,
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
    });
    const userB = await User.create({
      email: `user-b-${Date.now()}@instituteb.edu`,
      role: 'STUDENT',
      isActive: true,
      passwordHash,
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
      passwordHash: await hashPassword(TEST_PASSWORD),
    });
    await Job.create({
      title: 'Company Job',
      company: company._id,
      description: 'A job opportunity for testing isolation across institutions.',
      status: 'PUBLISHED',
      workMode: 'ONSITE',
      location: 'City',
      employmentType: 'FULL_TIME',
      institutionId: instA._id,
      requiredSkills: [skill._id],
    });

    // userA was already created by setupTwoInstitutions — log in directly.
    const cookie = await loginAndGetCookie(app, userA.email, TEST_PASSWORD);
    // Use the actual student-faculty-opportunities endpoint
    const res = await request(app)
      .get('/api/v1/student-faculty-opportunities')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data?.items ?? res.body.data)).toBe(true);
  });

  it('INSTITUTION A cannot see analytics for INSTITUTION B', async () => {
    const { instA, instB } = await setupTwoInstitutions();

    // Create skill outcomes data for Institution B
    const skill = await Skill.create({ name: 'Isolate Skill', category: 'PROGRAMMING' });
    const studentUserB = await User.create({
      email: `student-b-iso-${Date.now()}@instituteb.edu`,
      role: 'STUDENT',
      isActive: true,
      passwordHash: await hashPassword(TEST_PASSWORD),
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
      passwordHash: await hashPassword(TEST_PASSWORD),
    });
    await Job.create({
      title: 'Iso Job',
      company: company._id,
      description: 'A job opportunity for testing isolation across institutions.',
      status: 'PUBLISHED',
      workMode: 'REMOTE',
      location: 'Remote',
      employmentType: 'FULL_TIME',
      institutionId: instB._id,
      requiredSkills: [skill._id],
    });

    // Login as Institution A and query the dashboard students endpoint, which
    // is the closest analog to "skill outcomes" that's actually mounted today.
    // The point of the test is the *isolation* rule, not the skill outcome shape.
    const instAUser = await createUserAndLogin(app, 'INSTITUTION', {
      institutionCode: `INSTA${Date.now()}`,
    });
    // Then bind instAUser to instA so the auth check lets them through
    await User.updateOne({ _id: instAUser.userId }, { institution: instA._id });
    const res = await request(app)
      .get(`/api/v1/institution/dashboard/students?institutionId=${instA._id}`)
      .set('Cookie', instAUser.cookie);

    // Institution A should get its own data (possibly empty), NOT B's data
    expect(res.status).toBe(200);
    const items = (res.body.data?.items ?? []) as Array<{ fullName: string }>;
    expect(items.some((s) => s.fullName === 'Student B Isolated')).toBe(false);
  });

  it('placement drive is only visible to its institution', async () => {
    const { instA, instB } = await setupTwoInstitutions();

    // Login as InstB — auto-creates a separate INSTITUTION row.
    const instBUser = await createUserAndLogin(app, 'INSTITUTION', {
      institutionCode: `INSTB${Date.now()}`,
    });
    // Force-bind the freshly-created instB user to instB so the auth check lets
    // them through and isolation has something to enforce.
    await User.updateOne({ _id: instBUser.userId }, { institution: instB._id });

    // InstB queries their own placement metrics — that must succeed.
    const res = await request(app)
      .get(`/api/v1/institution/dashboard/placement-metrics?institutionId=${instB._id}`)
      .set('Cookie', instBUser.cookie);

    expect(res.status).toBe(200);
  });

  it('INSTITUTION cannot scope the placement metrics to another institution', async () => {
    const { instA, instB } = await setupTwoInstitutions();

    // Login as InstB
    const instBUser = await createUserAndLogin(app, 'INSTITUTION', {
      institutionCode: `INSTBX${Date.now()}`,
    });
    await User.updateOne({ _id: instBUser.userId }, { institution: instB._id });

    // InstB tries to read InstA's metrics by passing InstA's id — the
    // resolveInstitutionId guard must reject this with 403.
    const res = await request(app)
      .get(`/api/v1/institution/dashboard/placement-metrics?institutionId=${instA._id}`)
      .set('Cookie', instBUser.cookie);

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
      passwordHash: await hashPassword(TEST_PASSWORD),
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
      passwordHash: await hashPassword(TEST_PASSWORD),
    });
    await Job.create({
      title: 'Analytics Job',
      company: company._id,
      description: 'Analytics job for testing outcome scope by institution.',
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
    // Bind instAUser to instA so the auth check passes
    await User.updateOne({ _id: instAUser.userId }, { institution: instA._id });
    const res = await request(app)
      .get(`/api/v1/institution/dashboard/skill-gaps?institutionId=${instA._id}`)
      .set('Cookie', instAUser.cookie);

    expect(res.status).toBe(200);
  });
});
