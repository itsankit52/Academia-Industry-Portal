import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import { serializeLean } from '../serializeLean';

describe('serializeLean', () => {
  it('renames _id to id so the wire shape matches a hydrated document', () => {
    const id = new Types.ObjectId();
    const out = serializeLean({ _id: id, title: 'Backend Engineer' }) as Record<string, unknown>;
    expect(out.id).toBe(id.toHexString());
    expect(out._id).toBeUndefined();
  });

  it('drops the __v version key the toJSON transform also removes', () => {
    const out = serializeLean({ _id: new Types.ObjectId(), __v: 3 }) as Record<string, unknown>;
    expect(out.__v).toBeUndefined();
  });

  it('renders nested ObjectId values as hex strings', () => {
    const company = new Types.ObjectId();
    const out = serializeLean({ company }) as Record<string, unknown>;
    expect(out.company).toBe(company.toHexString());
  });

  it('walks into populated references so their _id is converted too', () => {
    const jobId = new Types.ObjectId();
    const companyId = new Types.ObjectId();
    const out = serializeLean({
      _id: jobId,
      company: { _id: companyId, companyName: 'Initech' },
    }) as Record<string, unknown>;
    const company = out.company as Record<string, unknown>;
    expect(out.id).toBe(jobId.toHexString());
    expect(company.id).toBe(companyId.toHexString());
    expect(company._id).toBeUndefined();
    expect(company.companyName).toBe('Initech');
  });

  it('walks into arrays of populated references', () => {
    const a = new Types.ObjectId();
    const b = new Types.ObjectId();
    const out = serializeLean({
      requiredSkills: [
        { _id: a, name: 'typescript' },
        { _id: b, name: 'mongodb' },
      ],
    }) as Record<string, unknown>;
    const skills = out.requiredSkills as Array<Record<string, unknown>>;
    expect(skills.map((s) => s.id)).toEqual([a.toHexString(), b.toHexString()]);
    expect(skills.map((s) => s.name)).toEqual(['typescript', 'mongodb']);
  });

  it('converts an array of rows, not just a single row', () => {
    const a = new Types.ObjectId();
    const b = new Types.ObjectId();
    const out = serializeLean([{ _id: a }, { _id: b }]) as Array<Record<string, unknown>>;
    expect(out.map((r) => r.id)).toEqual([a.toHexString(), b.toHexString()]);
  });

  // A Date is an object, so a naive recursive walk would enumerate its (zero)
  // own keys and flatten it to `{}` — silently destroying every deadline.
  it('leaves Date values intact instead of flattening them to an empty object', () => {
    const deadline = new Date('2026-06-01T00:00:00.000Z');
    const out = serializeLean({ applicationDeadline: deadline }) as Record<string, unknown>;
    expect(out.applicationDeadline).toBeInstanceOf(Date);
    expect((out.applicationDeadline as Date).toISOString()).toBe(deadline.toISOString());
  });

  it('leaves Buffer values intact', () => {
    const buf = Buffer.from('abc');
    const out = serializeLean({ blob: buf }) as Record<string, unknown>;
    expect(Buffer.isBuffer(out.blob)).toBe(true);
  });

  it('preserves null and undefined rather than coercing them', () => {
    const out = serializeLean({ minCgpa: null, stipend: undefined }) as Record<string, unknown>;
    expect(out.minCgpa).toBeNull();
    expect(out.stipend).toBeUndefined();
  });

  it('passes primitives and empty collections through unchanged', () => {
    expect(serializeLean('plain')).toBe('plain');
    expect(serializeLean(7)).toBe(7);
    expect(serializeLean(null)).toBeNull();
    expect(serializeLean([])).toEqual([]);
  });

  it('does not mutate the row it was given', () => {
    const id = new Types.ObjectId();
    const row = { _id: id, title: 'Analyst' };
    serializeLean(row);
    expect(row._id).toBe(id);
  });
});
