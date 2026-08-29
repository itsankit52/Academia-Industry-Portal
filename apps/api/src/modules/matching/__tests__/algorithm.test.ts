import { describe, expect, it } from 'vitest';
import { computeMatch } from '../algorithm';

function sorted(a: string[]): string[] {
  return [...a].sort();
}

describe('computeMatch', () => {
  it('exact-match required only → score 100, STRONG_MATCH', () => {
    // With no preferred skills listed, the required skills carry all 100 points.
    // This used to score 80 because the preferred slice was counted as missed,
    // which made STRONG_MATCH unreachable for any posting without preferred skills.
    const r = computeMatch(['a', 'b', 'c'], ['a', 'b', 'c'], []);
    expect(r.score).toBe(100);
    expect(r.level).toBe('STRONG_MATCH');
    expect(sorted(r.matchedSkills)).toEqual(['a', 'b', 'c']);
    expect(r.missingSkills).toEqual([]);
    expect(r.preferredMatched).toEqual([]);
    expect(r.extraSkills).toEqual([]);
    expect(r.recommendation).toContain('Excellent fit');
  });

  it('exact-match required + all preferred → score 100, STRONG_MATCH', () => {
    const r = computeMatch(['a', 'b', 'c', 'x', 'y'], ['a', 'b', 'c'], ['x', 'y']);
    expect(r.score).toBe(100);
    expect(r.level).toBe('STRONG_MATCH');
    expect(sorted(r.matchedSkills)).toEqual(['a', 'b', 'c']);
    expect(sorted(r.preferredMatched)).toEqual(['x', 'y']);
    expect(r.missingSkills).toEqual([]);
    expect(r.extraSkills).toEqual([]);
    expect(r.recommendation).toContain('Excellent fit');
  });

  it('half required matched, no preferred → score 50, GOOD_MATCH', () => {
    const r = computeMatch(['a', 'b'], ['a', 'b', 'c', 'd'], []);
    expect(r.score).toBe(50);
    expect(r.level).toBe('GOOD_MATCH');
    expect(sorted(r.matchedSkills)).toEqual(['a', 'b']);
    expect(sorted(r.missingSkills)).toEqual(['c', 'd']);
    expect(r.recommendation).toContain('Good fit');
  });

  it('half required matched, with preferred → required is worth 80 of the score', () => {
    const r = computeMatch(['a', 'b'], ['a', 'b', 'c', 'd'], ['x']);
    expect(r.score).toBe(40);
    expect(r.level).toBe('PARTIAL_MATCH');
  });

  it('zero matched → score 0, LOW_MATCH', () => {
    const r = computeMatch(['z'], ['a', 'b'], ['x']);
    expect(r.score).toBe(0);
    expect(r.level).toBe('LOW_MATCH');
    expect(r.matchedSkills).toEqual([]);
    expect(sorted(r.missingSkills)).toEqual(['a', 'b']);
    expect(r.preferredMatched).toEqual([]);
    expect(sorted(r.extraSkills)).toEqual(['z']);
    expect(r.recommendation).toContain('Low fit');
  });

  it('empty required + empty preferred → nothing to miss, so score 100', () => {
    // A posting that asks for no skills sets no bar. Scoring this 0/LOW_MATCH
    // told students they had "significant skill gaps" against an empty list.
    const r = computeMatch([], [], []);
    expect(r.score).toBe(100);
    expect(r.level).toBe('STRONG_MATCH');
    expect(r.matchedSkills).toEqual([]);
    expect(r.missingSkills).toEqual([]);
    expect(r.preferredMatched).toEqual([]);
    expect(r.extraSkills).toEqual([]);
  });

  it('preferred-only match (empty required) → score 100', () => {
    const r = computeMatch(['x'], [], ['x']);
    expect(r.score).toBe(100);
    expect(r.level).toBe('STRONG_MATCH');
    expect(r.matchedSkills).toEqual([]);
    expect(r.missingSkills).toEqual([]);
    expect(r.preferredMatched).toEqual(['x']);
    expect(r.extraSkills).toEqual([]);
  });

  it('preferred-only miss (empty required) → required met, preferred not → score 80', () => {
    const r = computeMatch([], [], ['x']);
    expect(r.score).toBe(80);
    expect(r.preferredMatched).toEqual([]);
  });

  it('extra student skills not in required or preferred appear in extraSkills', () => {
    const r = computeMatch(['a', 'x', 'q', 'r'], ['a'], ['x']);
    expect(sorted(r.matchedSkills)).toEqual(['a']);
    expect(sorted(r.preferredMatched)).toEqual(['x']);
    expect(sorted(r.extraSkills)).toEqual(['q', 'r']);
  });

  it('duplicate IDs are handled via Set semantics', () => {
    const r = computeMatch(['a', 'a', 'b', 'b'], ['a', 'a', 'c'], ['b', 'b']);
    expect(sorted(r.matchedSkills)).toEqual(['a']);
    expect(sorted(r.missingSkills)).toEqual(['c']);
    expect(sorted(r.preferredMatched)).toEqual(['b']);
    expect(r.extraSkills).toEqual([]);
    expect(r.score).toBe(Math.round((1 / 2) * 80 + (1 / 1) * 20));
  });

  it('IDs are compared as strings with exact case sensitivity', () => {
    const r = computeMatch(['A'], ['a'], ['A']);
    expect(r.matchedSkills).toEqual([]);
    expect(r.missingSkills).toEqual(['a']);
    expect(r.preferredMatched).toEqual(['A']);
    expect(r.extraSkills).toEqual([]);
  });

  it('coerces non-string ids to strings via map(String)', () => {
    const r = computeMatch([1 as unknown as string, 2 as unknown as string], ['1'], ['2']);
    expect(sorted(r.matchedSkills)).toEqual(['1']);
    expect(sorted(r.preferredMatched)).toEqual(['2']);
    expect(r.missingSkills).toEqual([]);
    expect(r.extraSkills).toEqual([]);
  });
});
