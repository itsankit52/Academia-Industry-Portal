import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  addMyStudentSkillByName: vi.fn<
    (
      userId: string,
      name: string,
    ) => Promise<{
      created: boolean;
      studentSkill: Record<string, unknown>;
    }>
  >(),
}));

vi.mock('../skills.service', () => ({
  addMyStudentSkillByName: mocks.addMyStudentSkillByName,
}));

// Mock the asyncHandler to run the inner function synchronously and capture the result
let lastControllerResult: unknown;
vi.mock('../../../utils/asyncHandler', () => ({
  asyncHandler:
    (fn: (req: unknown, res: unknown, next: unknown) => Promise<unknown>) =>
    (req: unknown, res: unknown, _next: unknown) => {
      Promise.resolve(fn(req, res, _next))
        .then((r) => {
          lastControllerResult = r;
        })
        .catch((err) => {
          lastControllerResult = { __error: err };
        });
    },
}));

// ok() just returns the data; our mock captures it via asyncHandler
vi.mock('../../../utils/apiResponse', () => ({
  ok: (_res: unknown, data: unknown) => data,
  created: (_res: unknown, data: unknown) => data,
  noContent: () => undefined,
}));

vi.mock('../skillProfile.service', () => ({
  buildSkillProfile: vi.fn(),
  buildSkillTimeline: vi.fn(),
}));

// Import AFTER all mocks are set
import type { Request, Response, NextFunction } from 'express';
import { addSkillsFromResume } from '../skills.controller';

function makeReq(body: { skills?: unknown }, userId = 'user-1'): Request {
  return { body, user: { id: userId } } as unknown as Request;
}
function makeRes(): Response {
  return {} as unknown as Response;
}
function makeNext(): NextFunction {
  return (() => undefined) as unknown as NextFunction;
}

describe('addSkillsFromResume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastControllerResult = undefined;
  });

  // Helper: flush the microtask queue so the asyncHandler promise settles
  async function flush() {
    await new Promise((r) => setTimeout(r, 0));
  }

  it('returns empty result for an empty skills array', async () => {
    addSkillsFromResume(makeReq({ skills: [] }), makeRes(), makeNext());
    await flush();
    expect(lastControllerResult).toEqual({ added: [], skipped: [], notFound: [] });
    expect(mocks.addMyStudentSkillByName).not.toHaveBeenCalled();
  });

  it('filters out null, undefined, number, and empty-string entries', async () => {
    mocks.addMyStudentSkillByName.mockResolvedValue({
      created: true,
      studentSkill: { _id: 's1', skill: { name: 'React' } },
    });
    addSkillsFromResume(
      makeReq({ skills: ['React', '', '  ', null, undefined, 42, 'Python'] }),
      makeRes(),
      makeNext(),
    );
    await flush();
    expect(mocks.addMyStudentSkillByName).toHaveBeenCalledTimes(2);
    expect(mocks.addMyStudentSkillByName.mock.calls.map((c) => c[1])).toEqual(['React', 'Python']);
  });

  it('categorises a newly created skill as "added"', async () => {
    mocks.addMyStudentSkillByName.mockResolvedValue({
      created: true,
      studentSkill: { _id: 's1', skill: { name: 'React' } },
    });
    addSkillsFromResume(makeReq({ skills: ['React'] }), makeRes(), makeNext());
    await flush();
    const r = lastControllerResult as { added: unknown[]; skipped: string[]; notFound: string[] };
    expect(r.added).toHaveLength(1);
    expect(r.skipped).toHaveLength(0);
    expect(r.notFound).toHaveLength(0);
  });

  it('categorises an already-existing skill as "skipped"', async () => {
    mocks.addMyStudentSkillByName.mockResolvedValue({
      created: false,
      studentSkill: { _id: 's1', skill: { name: 'React' } },
    });
    addSkillsFromResume(makeReq({ skills: ['React'] }), makeRes(), makeNext());
    await flush();
    const r = lastControllerResult as { added: unknown[]; skipped: string[]; notFound: string[] };
    expect(r.added).toHaveLength(0);
    expect(r.skipped).toEqual(['React']);
    expect(r.notFound).toHaveLength(0);
  });

  it('categorises a catalogue-404 error as "notFound"', async () => {
    mocks.addMyStudentSkillByName.mockRejectedValue(
      new Error(
        '"UnknownSkill" is not in the skills catalogue yet. Use the Add Skill form to suggest it.',
      ),
    );
    addSkillsFromResume(makeReq({ skills: ['UnknownSkill'] }), makeRes(), makeNext());
    await flush();
    const r = lastControllerResult as { added: unknown[]; skipped: string[]; notFound: string[] };
    expect(r.added).toHaveLength(0);
    expect(r.skipped).toHaveLength(0);
    expect(r.notFound).toEqual(['UnknownSkill']);
  });

  it('handles a mix of added, skipped, and notFound simultaneously', async () => {
    mocks.addMyStudentSkillByName.mockImplementation(
      async (
        _uid: string,
        name: string,
      ): Promise<{ created: boolean; studentSkill: Record<string, unknown> }> => {
        if (name === 'react') return { created: true, studentSkill: { skill: { name } } };
        if (name === 'python') return { created: false, studentSkill: { skill: { name } } };
        throw new Error(`"${name}" is not in the skills catalogue yet.`);
      },
    );
    addSkillsFromResume(makeReq({ skills: ['react', 'python', 'Klingon'] }), makeRes(), makeNext());
    await flush();
    const r = lastControllerResult as { added: unknown[]; skipped: string[]; notFound: string[] };
    expect(r.added).toHaveLength(1);
    expect(r.skipped).toEqual(['python']);
    expect(r.notFound).toEqual(['Klingon']);
  });

  it('passes req.user.id as the student id to the service', async () => {
    mocks.addMyStudentSkillByName.mockResolvedValue({
      created: true,
      studentSkill: { _id: 's1', skill: { name: 'react' } },
    });
    addSkillsFromResume(makeReq({ skills: ['react'] }, 'student-99'), makeRes(), makeNext());
    await flush();
    expect(mocks.addMyStudentSkillByName).toHaveBeenCalledWith('student-99', 'react');
  });

  it('rethrows non-catalogue errors as result.__error (asyncHandler catches and calls next)', async () => {
    const dbError = new Error('Database is on fire');
    mocks.addMyStudentSkillByName.mockRejectedValue(dbError);
    addSkillsFromResume(makeReq({ skills: ['react'] }), makeRes(), makeNext());
    await flush();
    const r = lastControllerResult as { __error?: Error };
    expect(r.__error).toBe(dbError);
  });
});
