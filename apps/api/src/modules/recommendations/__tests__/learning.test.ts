import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  StudentProfile: { findOne: vi.fn() },
  StudentSkill: { find: vi.fn() },
  Application: { find: vi.fn() },
  Job: { find: vi.fn(), findById: vi.fn() },
  Internship: { find: vi.fn(), findById: vi.fn() },
  Skill: { find: vi.fn() },
  TrainingProgram: { find: vi.fn() },
  MentorProfile: { find: vi.fn() },
  CollaborationEvent: { find: vi.fn() },
}));

import {
  CollaborationEvent,
  Internship,
  Job,
  MentorProfile,
  Skill,
  StudentProfile,
  StudentSkill,
  TrainingProgram,
} from '../../../models';
import {
  recommendLearning,
  recommendMentors,
  recommendWorkshops,
} from '../recommendations.service';

interface Chain<T> {
  populate: () => Chain<T>;
  select: () => Chain<T>;
  sort: () => Chain<T>;
  skip: () => Chain<T>;
  limit: () => Chain<T>;
  lean: () => Promise<T>;
  then: <R>(onF: (v: T) => R, onR?: (r: unknown) => R) => Promise<R>;
}

function query<T>(result: T): Chain<T> {
  const q = {} as Chain<T>;
  q.populate = () => q;
  q.select = () => q;
  q.sort = () => q;
  q.skip = () => q;
  q.limit = () => q;
  q.lean = () => Promise.resolve(result);
  q.then = (onF, onR) => Promise.resolve(result).then(onF, onR);
  return q;
}

const STUDENT_PROFILE_ID = new Types.ObjectId();
const STUDENT_USER_ID = new Types.ObjectId().toString();

const SKILL_PYTHON = new Types.ObjectId();
const SKILL_REACT = new Types.ObjectId();
const SKILL_SQL = new Types.ObjectId();

function setupStudentSkillContext() {
  vi.mocked(StudentProfile.findOne).mockReturnValue({
    populate: () => ({
      populate: () => ({
        populate: () =>
          Promise.resolve({
            _id: STUDENT_PROFILE_ID,
            cgpa: 8,
            branch: 'CSE',
            graduationYear: 2025,
          }),
      }),
    }),
  } as never);
  vi.mocked(StudentSkill.find).mockReturnValue(
    query([{ skill: SKILL_PYTHON }, { skill: SKILL_SQL }]) as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setupStudentSkillContext();
  vi.mocked(Job.find).mockReturnValue(query([]) as never);
  vi.mocked(Internship.find).mockReturnValue(query([]) as never);
  vi.mocked(Job.findById).mockReturnValue(query(null) as never);
  vi.mocked(Internship.findById).mockReturnValue(query(null) as never);
  vi.mocked(Skill.find).mockReturnValue(query([]) as never);
  vi.mocked(TrainingProgram.find).mockReturnValue(query([]) as never);
  vi.mocked(MentorProfile.find).mockReturnValue(query([]) as never);
  vi.mocked(CollaborationEvent.find).mockReturnValue(query([]) as never);
});

describe('recommendLearning', () => {
  it('returns empty when the student has no skill gaps', async () => {
    vi.mocked(Skill.find).mockReturnValue(
      query([
        { _id: SKILL_PYTHON, name: 'python' },
        { _id: SKILL_SQL, name: 'sql' },
      ]) as never,
    );
    vi.mocked(Job.find).mockReturnValue(
      query([
        {
          _id: new Types.ObjectId(),
          requiredSkills: [SKILL_PYTHON, SKILL_SQL],
          preferredSkills: [],
          status: 'PUBLISHED',
        },
      ]) as never,
    );

    const result = await recommendLearning(STUDENT_USER_ID, {});
    expect(result.trainings).toEqual([]);
    expect(result.mentors).toEqual([]);
    expect(result.workshops).toEqual([]);
    expect(result.missingSkills).toEqual([]);
  });

  it('returns trainings ranked by overlap with missing skills', async () => {
    vi.mocked(Skill.find).mockReturnValue(
      query([{ _id: SKILL_REACT, name: 'react', category: 'TECHNICAL' }]) as never,
    );
    vi.mocked(Job.find).mockReturnValue(
      query([
        {
          _id: new Types.ObjectId(),
          requiredSkills: [SKILL_REACT],
          preferredSkills: [],
          status: 'PUBLISHED',
        },
      ]) as never,
    );
    const t1 = { _id: new Types.ObjectId(), title: 'React 101', skills: [{ _id: SKILL_REACT }] };
    const t2 = { _id: new Types.ObjectId(), title: 'Other', skills: [] };
    vi.mocked(TrainingProgram.find).mockReturnValue(query([t1, t2]) as never);

    const result = await recommendLearning(STUDENT_USER_ID, {});
    expect(result.trainings.length).toBeGreaterThanOrEqual(1);
    expect(result.trainings[0]?.training.title).toBe('React 101');
    expect(result.trainings[0]?.overlapCount).toBe(1);
    expect(result.missingSkills[0]?.name).toBe('react');
  });

  it('returns mentors whose expertise matches missing skills', async () => {
    vi.mocked(Skill.find).mockReturnValue(
      query([{ _id: SKILL_REACT, name: 'react', category: 'TECHNICAL' }]) as never,
    );
    vi.mocked(Job.find).mockReturnValue(
      query([
        {
          _id: new Types.ObjectId(),
          requiredSkills: [SKILL_REACT],
          preferredSkills: [],
          status: 'PUBLISHED',
        },
      ]) as never,
    );
    const mentorMatch = {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(),
      expertise: ['react', 'node'],
      availability: 'AVAILABLE',
    };
    const mentorNoMatch = {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(),
      expertise: ['cooking'],
      availability: 'AVAILABLE',
    };
    vi.mocked(MentorProfile.find).mockReturnValue(query([mentorMatch, mentorNoMatch]) as never);

    const result = await recommendLearning(STUDENT_USER_ID, {});
    expect(result.mentors).toHaveLength(1);
    expect(result.mentors[0]?.expertiseMatch).toEqual(['react']);
  });

  it('returns workshops whose tags match missing skills', async () => {
    vi.mocked(Skill.find).mockReturnValue(
      query([{ _id: SKILL_REACT, name: 'react', category: 'TECHNICAL' }]) as never,
    );
    vi.mocked(Job.find).mockReturnValue(
      query([
        {
          _id: new Types.ObjectId(),
          requiredSkills: [SKILL_REACT],
          preferredSkills: [],
          status: 'PUBLISHED',
        },
      ]) as never,
    );
    const future = new Date(Date.now() + 86400000);
    const eventMatch = {
      _id: new Types.ObjectId(),
      title: 'React Bootcamp',
      tags: ['react', 'frontend'],
      status: 'PUBLISHED',
      startAt: future,
    };
    const eventNoMatch = {
      _id: new Types.ObjectId(),
      title: 'Other',
      tags: ['cooking'],
      status: 'PUBLISHED',
      startAt: future,
    };
    vi.mocked(CollaborationEvent.find).mockReturnValue(query([eventMatch, eventNoMatch]) as never);

    const result = await recommendLearning(STUDENT_USER_ID, {});
    expect(result.workshops).toHaveLength(1);
    expect(result.workshops[0]?.event.title).toBe('React Bootcamp');
    expect(result.workshops[0]?.tagMatch).toEqual(['react']);
  });

  it('uses the target opportunity when provided instead of scanning all jobs', async () => {
    const TARGET_ID = new Types.ObjectId().toString();
    vi.mocked(Skill.find).mockReturnValue(
      query([{ _id: SKILL_REACT, name: 'react', category: 'TECHNICAL' }]) as never,
    );
    vi.mocked(Job.findById).mockReturnValue(
      query({
        _id: new Types.ObjectId(),
        requiredSkills: [SKILL_REACT],
        preferredSkills: [],
      }) as never,
    );

    const result = await recommendLearning(STUDENT_USER_ID, {
      targetOpportunityId: TARGET_ID,
      targetOpportunityType: 'JOB',
    });
    expect(result.targetOpportunityId).toBe(TARGET_ID);
    expect(result.targetOpportunityType).toBe('JOB');
    expect(Job.findById).toHaveBeenCalled();
    expect(Job.find).not.toHaveBeenCalled();
  });

  it('falls back to all published opportunities when the target id is invalid', async () => {
    vi.mocked(Job.findById).mockReturnValue(query(null) as never);
    vi.mocked(Job.find).mockReturnValue(query([]) as never);

    const result = await recommendLearning(STUDENT_USER_ID, {
      targetOpportunityId: new Types.ObjectId().toString(),
      targetOpportunityType: 'JOB',
    });
    expect(result.targetOpportunityId).toBeDefined();
    expect(Job.find).toHaveBeenCalled();
  });

  it('handles INTERNSHIP target opportunity type', async () => {
    const TARGET_ID = new Types.ObjectId().toString();
    vi.mocked(Skill.find).mockReturnValue(
      query([{ _id: SKILL_REACT, name: 'react', category: 'TECHNICAL' }]) as never,
    );
    vi.mocked(Internship.findById).mockReturnValue(
      query({
        _id: new Types.ObjectId(),
        requiredSkills: [SKILL_REACT],
        preferredSkills: [],
      }) as never,
    );

    const result = await recommendLearning(STUDENT_USER_ID, {
      targetOpportunityId: TARGET_ID,
      targetOpportunityType: 'INTERNSHIP',
    });
    expect(result.targetOpportunityType).toBe('INTERNSHIP');
    expect(Internship.findById).toHaveBeenCalled();
  });
});

describe('recommendMentors', () => {
  it('returns empty when no missing skills', async () => {
    const result = await recommendMentors(STUDENT_USER_ID, []);
    expect(result).toEqual([]);
    expect(MentorProfile.find).not.toHaveBeenCalled();
  });

  it('excludes mentors who do not match any missing skill', async () => {
    vi.mocked(Skill.find).mockReturnValue(
      query([{ _id: SKILL_REACT, name: 'react', category: 'TECHNICAL' }]) as never,
    );
    vi.mocked(MentorProfile.find).mockReturnValue(
      query([
        {
          _id: new Types.ObjectId(),
          user: new Types.ObjectId(),
          expertise: ['cooking'],
          availability: 'AVAILABLE',
        },
      ]) as never,
    );

    const result = await recommendMentors(STUDENT_USER_ID, [SKILL_REACT.toString()]);
    expect(result).toEqual([]);
  });

  it('ranks mentors by the number of matching expertise areas', async () => {
    vi.mocked(Skill.find).mockReturnValue(
      query([
        { _id: SKILL_REACT, name: 'react' },
        { _id: SKILL_SQL, name: 'sql' },
      ]) as never,
    );
    const m1 = {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(),
      expertise: ['react', 'sql'],
      availability: 'AVAILABLE',
    };
    const m2 = {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(),
      expertise: ['react'],
      availability: 'AVAILABLE',
    };
    vi.mocked(MentorProfile.find).mockReturnValue(query([m2, m1]) as never);

    const result = await recommendMentors(STUDENT_USER_ID, [
      SKILL_REACT.toString(),
      SKILL_SQL.toString(),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]?.expertiseMatchCount).toBe(2);
    expect(result[1]?.expertiseMatchCount).toBe(1);
  });
});

describe('recommendWorkshops', () => {
  it('returns empty when no missing skills', async () => {
    const result = await recommendWorkshops(STUDENT_USER_ID, []);
    expect(result).toEqual([]);
    expect(CollaborationEvent.find).not.toHaveBeenCalled();
  });

  it('filters out events with no matching tags', async () => {
    vi.mocked(Skill.find).mockReturnValue(query([{ _id: SKILL_REACT, name: 'react' }]) as never);
    const future = new Date(Date.now() + 86400000);
    vi.mocked(CollaborationEvent.find).mockReturnValue(
      query([
        {
          _id: new Types.ObjectId(),
          title: 'Cooking Class',
          tags: ['cooking'],
          status: 'PUBLISHED',
          startAt: future,
        },
      ]) as never,
    );

    const result = await recommendWorkshops(STUDENT_USER_ID, [SKILL_REACT.toString()]);
    expect(result).toEqual([]);
  });
});
