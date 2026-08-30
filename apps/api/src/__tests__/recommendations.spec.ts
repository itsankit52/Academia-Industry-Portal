import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, hasTestDb } from './helpers/app';
import { clearTestDb, connectTestDb, disconnectTestDb } from './helpers/db';
import {
  createJobViaService,
  createSkillRow,
  createUserAndLogin,
} from './helpers/fixtures';
import { StudentProfile, StudentSkill } from '../models';

describe.skipIf(!hasTestDb)('recommendations', () => {
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

  it('GET /recommendations/jobs returns list ranked by matchScore desc', async () => {
    const company = await createUserAndLogin(app, 'COMPANY', {
      email: 'reco-co@t.demo',
      companyName: 'Reco Co',
    });
    const student = await createUserAndLogin(app, 'STUDENT', { email: 'reco-st@t.demo' });

    const skillA = await createSkillRow('React');
    const skillB = await createSkillRow('TypeScript');
    const skillC = await createSkillRow('Node.js');
    const skillD = await createSkillRow('Django');

    const profile = await StudentProfile.findOne({ user: student.userId });
    if (!profile) throw new Error('student profile missing');
    await StudentSkill.insertMany([
      { student: profile._id, skill: skillA._id, proficiency: 'ADVANCED', yearsExperience: 2 },
      { student: profile._id, skill: skillB._id, proficiency: 'ADVANCED', yearsExperience: 2 },
      { student: profile._id, skill: skillC._id, proficiency: 'INTERMEDIATE', yearsExperience: 1 },
    ]);

    const highJob = await createJobViaService(company.userId, {
      title: 'High Match Job',
      requiredSkillIds: [String(skillA._id), String(skillB._id)],
      preferredSkillIds: [String(skillC._id)],
    });
    const lowJob = await createJobViaService(company.userId, {
      title: 'Low Match Job',
      requiredSkillIds: [String(skillD._id)],
      preferredSkillIds: [],
    });

    const res = await request(app)
      .get('/api/v1/recommendations/jobs')
      .set('Cookie', student.cookie);
    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{
      job: { id: string; title: string };
      matchResult: { score: number };
    }>;
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]!.job.title).toBe((highJob as unknown as { title: string }).title);
    expect(items[0]!.matchResult.score).toBeGreaterThanOrEqual(items[1]!.matchResult.score);
    const titles = items.map((i) => i.job.title);
    expect(titles.indexOf((highJob as unknown as { title: string }).title)).toBeLessThan(
      titles.indexOf((lowJob as unknown as { title: string }).title),
    );
  });
});
