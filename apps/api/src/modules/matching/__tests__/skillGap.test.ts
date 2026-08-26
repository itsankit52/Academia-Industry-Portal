import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { analyzeSkillGap, idOf, normalizeIds, type RawSkill } from '../skillGap';

function skill(name: string, id = new Types.ObjectId().toHexString()): RawSkill {
  return { id, name };
}

function names(list: { name: string }[]): string[] {
  return list.map((s) => s.name).sort();
}

describe('idOf', () => {
  it('renders an ObjectId as its hex string', () => {
    const oid = new Types.ObjectId();
    expect(idOf(oid)).toBe(oid.toHexString());
  });

  it('unwraps a populated document to its _id', () => {
    const oid = new Types.ObjectId();
    expect(idOf({ _id: oid, name: 'python' })).toBe(oid.toHexString());
  });

  it('passes a plain string through, trimmed', () => {
    expect(idOf('  abc  ')).toBe('abc');
  });

  it('maps null and undefined to the empty string', () => {
    expect(idOf(null)).toBe('');
    expect(idOf(undefined)).toBe('');
  });
});

describe('normalizeIds', () => {
  it('drops blanks and duplicates while preserving order', () => {
    const a = new Types.ObjectId();
    expect(normalizeIds([a, null, String(a), '', 'b', 'b'])).toEqual([a.toHexString(), 'b']);
  });

  it('treats an ObjectId and its string form as the same id', () => {
    const a = new Types.ObjectId();
    expect(normalizeIds([a, a.toHexString(), { _id: a }])).toHaveLength(1);
  });
});

describe('analyzeSkillGap', () => {
  it('computes matched, missing and percentage from the intersection', () => {
    const python = skill('python');
    const sql = skill('sql');
    const react = skill('react');
    const gap = analyzeSkillGap([python, sql], [python, sql, react], []);

    expect(names(gap.matchedSkills)).toEqual(['python', 'sql']);
    expect(names(gap.missingSkills)).toEqual(['react']);
    expect(gap.matchPercentage).toBe(67); // 2/3 → 66.67 rounded
    expect(gap.studentSkillCount).toBe(2);
  });

  it('reports 100% and no gap when every required skill is held', () => {
    const a = skill('python');
    const b = skill('sql');
    const gap = analyzeSkillGap([a, b], [a, b], []);
    expect(gap.matchPercentage).toBe(100);
    expect(gap.missingSkills).toEqual([]);
    expect(gap.score).toBe(100);
    expect(gap.level).toBe('STRONG_MATCH');
  });

  it('reports 0% when none of the required skills are held', () => {
    const gap = analyzeSkillGap([skill('cobol')], [skill('python'), skill('sql')], []);
    expect(gap.matchPercentage).toBe(0);
    expect(gap.matchedSkills).toEqual([]);
    expect(names(gap.missingSkills)).toEqual(['python', 'sql']);
    expect(gap.level).toBe('LOW_MATCH');
  });

  // Division by zero would produce NaN and render as "NaN%".
  it('treats an opportunity with no required skills as fully met', () => {
    const gap = analyzeSkillGap([skill('python')], [], []);
    expect(gap.matchPercentage).toBe(100);
    expect(gap.requiredSkills).toEqual([]);
    expect(gap.missingSkills).toEqual([]);
    expect(Number.isNaN(gap.matchPercentage)).toBe(false);
    expect(Number.isNaN(gap.score)).toBe(false);
  });

  it('handles a student with no skills at all', () => {
    const gap = analyzeSkillGap([], [skill('python')], []);
    expect(gap.matchPercentage).toBe(0);
    expect(gap.studentSkillCount).toBe(0);
    expect(names(gap.missingSkills)).toEqual(['python']);
  });

  it('ignores case and surrounding whitespace when comparing names', () => {
    const gap = analyzeSkillGap(
      [{ id: '1', name: '  PyThOn ' }],
      [{ id: '2', name: 'python' }],
      [],
    );
    expect(gap.matchPercentage).toBe(100);
    expect(gap.missingSkills).toEqual([]);
  });

  it('collapses internal whitespace differences', () => {
    const gap = analyzeSkillGap(
      [{ id: '1', name: 'machine   learning' }],
      [{ id: '2', name: 'Machine Learning' }],
      [],
    );
    expect(gap.matchPercentage).toBe(100);
  });

  // The same skill seeded twice under different ids must not read as a gap.
  it('deduplicates skills that share a name but not an id', () => {
    const gap = analyzeSkillGap(
      [{ id: 'a1', name: 'python' }],
      [
        { id: 'b1', name: 'python' },
        { id: 'b2', name: 'Python' },
      ],
      [],
    );
    expect(gap.requiredSkills).toHaveLength(1);
    expect(gap.matchPercentage).toBe(100);
  });

  it('deduplicates repeated entries on the student side', () => {
    const python = skill('python');
    const gap = analyzeSkillGap([python, python, { ...python }], [python], []);
    expect(gap.studentSkillCount).toBe(1);
    expect(gap.matchPercentage).toBe(100);
  });

  it('matches an ObjectId-backed skill against its string-id twin by name', () => {
    const oid = new Types.ObjectId();
    const gap = analyzeSkillGap(
      [{ id: oid, name: 'python' }],
      [{ id: oid.toHexString(), name: 'python' }],
      [],
    );
    expect(gap.matchPercentage).toBe(100);
    expect(gap.matchedSkills[0]?.id).toBe(oid.toHexString());
  });

  it('skips entries with no usable name rather than showing a raw id', () => {
    const gap = analyzeSkillGap(
      [skill('python')],
      [skill('python'), { id: 'orphan', name: undefined }, { id: 'blank', name: '   ' }],
      [],
    );
    expect(gap.requiredSkills).toHaveLength(1);
    expect(gap.matchPercentage).toBe(100);
  });

  it('credits preferred skills separately from required ones', () => {
    const python = skill('python');
    const docker = skill('docker');
    const gap = analyzeSkillGap([python, docker], [python], [docker]);
    expect(names(gap.preferredMatched)).toEqual(['docker']);
    expect(gap.matchPercentage).toBe(100);
    expect(gap.score).toBe(100);
  });

  it('does not double-count a skill listed as both required and preferred', () => {
    const python = skill('python');
    const gap = analyzeSkillGap([python], [python], [python]);
    expect(gap.preferredSkills).toEqual([]);
    expect(gap.score).toBe(100);
  });

  it('percentage tracks required skills only, ignoring unmatched preferred ones', () => {
    const python = skill('python');
    const gap = analyzeSkillGap([python], [python], [skill('kubernetes')]);
    expect(gap.matchPercentage).toBe(100);
    expect(gap.preferredMatched).toEqual([]);
    // Preferred skills still pull the weighted score below a perfect 100.
    expect(gap.score).toBe(80);
  });

  it('never returns NaN or an out-of-range percentage for any input shape', () => {
    const cases: [RawSkill[], RawSkill[], RawSkill[]][] = [
      [[], [], []],
      [[skill('a')], [], []],
      [[], [skill('a')], []],
      [[], [], [skill('a')]],
      [[{ id: null, name: null }], [{ id: undefined, name: '' }], []],
    ];
    for (const [student, required, preferred] of cases) {
      const gap = analyzeSkillGap(student, required, preferred);
      expect(Number.isFinite(gap.matchPercentage)).toBe(true);
      expect(gap.matchPercentage).toBeGreaterThanOrEqual(0);
      expect(gap.matchPercentage).toBeLessThanOrEqual(100);
      expect(Number.isFinite(gap.score)).toBe(true);
      expect(gap.score).toBeGreaterThanOrEqual(0);
      expect(gap.score).toBeLessThanOrEqual(100);
    }
  });

  it('only ever reports skills that were supplied — it never invents any', () => {
    const supplied = new Set(['python', 'sql', 'react']);
    const gap = analyzeSkillGap([skill('python')], [skill('sql'), skill('react')], []);
    for (const s of [...gap.requiredSkills, ...gap.matchedSkills, ...gap.missingSkills]) {
      expect(supplied.has(s.name)).toBe(true);
    }
  });
});
