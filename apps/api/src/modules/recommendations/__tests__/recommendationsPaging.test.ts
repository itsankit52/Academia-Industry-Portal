/**
 * Phase-2 performance work — recommendJobs / recommendInternships sort the raw
 * rows and serialize only the returned page. These tests pin down that the
 * output (items, order, ties, totals, wire shape) is unchanged and that rows
 * outside the page are never converted or mutated.
 */
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SerializeLeanModule from '../../../utils/serializeLean';

vi.mock('../../../models', () => ({
  StudentProfile: { findOne: vi.fn() },
  StudentSkill: { find: vi.fn() },
  Application: { find: vi.fn() },
  Job: { find: vi.fn() },
  Internship: { find: vi.fn() },
  Skill: { find: vi.fn() },
  TrainingProgram: { find: vi.fn() },
}));

vi.mock('../../../utils/serializeLean', async (importActual) => {
  const actual = await importActual<typeof SerializeLeanModule>();
  return { serializeLean: vi.fn(actual.serializeLean) };
});

import { Application, Internship, Job, StudentProfile, StudentSkill } from '../../../models';
import { serializeLean } from '../../../utils/serializeLean';
import { computeMatch } from '../../matching/algorithm';
import { recommendInternships, recommendJobs } from '../recommendations.service';

function query<T>(result: T) {
  const q: Record<string, unknown> = {};
  for (const k of ['populate', 'select', 'sort', 'skip', 'limit']) q[k] = () => q;
  q.lean = () => Promise.resolve(result);
  q.then = (f: (v: T) => unknown, r?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(f, r);
  return q;
}

const oid = () => new Types.ObjectId();
const USER = oid().toString();
const S1 = oid();
const S2 = oid();
const S3 = oid();

/** Postings with deliberately tied scores, in a known input order. */
function postings() {
  const skill = (id: Types.ObjectId, name: string) => ({ _id: id, name, category: 'BACKEND' });
  const mk = (title: string, required: Types.ObjectId[]) => ({
    _id: oid(),
    __v: 0,
    title,
    status: 'PUBLISHED',
    company: { _id: oid(), companyName: `${title} Co`, logoUrl: '' },
    requiredSkills: required.map((r, i) => skill(r, `skill-${i}`)),
    preferredSkills: [],
  });
  return [
    mk('half-a', [S1, S2]),
    mk('full-a', [S1]),
    mk('none-a', [S3]),
    mk('half-b', [S1, S3]),
    mk('full-b', [S1]),
    mk('none-b', [S2, S3]),
    mk('full-c', [S1]),
  ];
}

function expectedOrder(rows: ReturnType<typeof postings>): string[] {
  const score = (r: (typeof rows)[number]) =>
    computeMatch(
      [String(S1)],
      r.requiredSkills.map((s) => String(s._id)),
      [],
    ).score;
  // Array.prototype.sort is stable: ties keep input order.
  return [...rows].sort((a, b) => score(b) - score(a)).map((r) => r.title);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(StudentProfile.findOne).mockReturnValue(
    query({ _id: oid(), cgpa: 8, branch: 'CSE', graduationYear: 2025 }) as never,
  );
  vi.mocked(StudentSkill.find).mockReturnValue(
    query([{ skill: S1, proficiency: 'INTERMEDIATE' }]) as never,
  );
  vi.mocked(Application.find).mockReturnValue(query([]) as never);
});

describe('recommendJobs — sort before serialize', () => {
  it('returns the stable score order (ties keep input order) across every page', async () => {
    const rows = postings();
    vi.mocked(Job.find).mockReturnValue(query(rows) as never);
    const order = expectedOrder(rows);
    // the fixture must actually contain ties for this test to mean anything
    const scores = rows.map(
      (r) =>
        computeMatch(
          [String(S1)],
          r.requiredSkills.map((s) => String(s._id)),
          [],
        ).score,
    );
    expect(new Set(scores).size).toBeLessThan(rows.length);

    const p1 = await recommendJobs(USER, { page: 1, pageSize: 3 });
    const p2 = await recommendJobs(USER, { page: 2, pageSize: 3 });
    const p3 = await recommendJobs(USER, { page: 3, pageSize: 3 });
    const titles = [...p1.items, ...p2.items, ...p3.items].map((i) => i.job.title);
    expect(titles).toEqual(order);
    expect(p1.total).toBe(rows.length);
    expect(p3.items).toHaveLength(1);
  });

  it('serializes only the returned page', async () => {
    vi.mocked(Job.find).mockReturnValue(query(postings()) as never);
    await recommendJobs(USER, { page: 1, pageSize: 2 });
    expect(serializeLean).toHaveBeenCalledTimes(2);
  });

  it('keeps the public wire shape: id (no _id/__v) and normalized company', async () => {
    vi.mocked(Job.find).mockReturnValue(query(postings()) as never);
    const res = await recommendJobs(USER, { page: 1, pageSize: 7 });
    for (const item of res.items) {
      const job = item.job as unknown as Record<string, unknown>;
      expect(typeof job.id).toBe('string');
      expect(job).not.toHaveProperty('_id');
      expect(job).not.toHaveProperty('__v');
      expect(job.company).toEqual(expect.objectContaining({ name: `${String(job.title)} Co` }));
      expect(Object.keys(item)[0]).toBe('job'); // key order unchanged
    }
  });

  it('never mutates the source rows', async () => {
    const rows = postings();
    const snapshot = JSON.stringify(rows);
    vi.mocked(Job.find).mockReturnValue(query(rows) as never);
    await recommendJobs(USER, { page: 1, pageSize: 3 });
    expect(JSON.stringify(rows)).toBe(snapshot);
  });
});

describe('recommendInternships — sort before serialize', () => {
  it('returns the same stable order and serializes only the page', async () => {
    const rows = postings();
    vi.mocked(Internship.find).mockReturnValue(query(rows) as never);
    const res = await recommendInternships(USER, { page: 1, pageSize: 4 });
    expect(res.items.map((i) => i.internship.title)).toEqual(expectedOrder(rows).slice(0, 4));
    expect(res.total).toBe(rows.length);
    expect(serializeLean).toHaveBeenCalledTimes(4);
    const first = res.items[0]!.internship as unknown as Record<string, unknown>;
    expect(first).not.toHaveProperty('_id');
    expect(Object.keys(res.items[0]!)[0]).toBe('internship');
  });
});
