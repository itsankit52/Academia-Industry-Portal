import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SkillGapAnalysis } from '../../matching/skillGap';

const isConfigured = vi.fn<() => boolean>(() => false);
const generateContent = vi.fn();
const computeSkillGap = vi.fn<() => Promise<SkillGapAnalysis>>();

vi.mock('../../../config/gemini', () => ({
  isGeminiConfigured: () => isConfigured(),
  getModel: () => ({ generateContent }),
  getGeminiClient: () => {
    throw new Error('not used in these tests');
  },
  getModelName: () => 'test-model',
}));

vi.mock('../../matching/skillGap', () => ({
  computeSkillGap: () => computeSkillGap(),
}));

const { explainJobMatch } = await import('../ai.service');

function analysis(overrides: Partial<SkillGapAnalysis> = {}): SkillGapAnalysis {
  return {
    opportunityId: '507f1f77bcf86cd799439011',
    opportunityType: 'JOB',
    opportunityTitle: 'Backend Engineer',
    requiredSkills: [
      { id: '1', name: 'python' },
      { id: '2', name: 'sql' },
      { id: '3', name: 'react' },
    ],
    matchedSkills: [
      { id: '1', name: 'python' },
      { id: '2', name: 'sql' },
    ],
    missingSkills: [{ id: '3', name: 'react' }],
    preferredSkills: [],
    preferredMatched: [],
    studentSkillCount: 2,
    matchPercentage: 67,
    score: 67,
    level: 'GOOD_MATCH',
    recommendation: 'Good fit — you meet most core requirements.',
    ...overrides,
  };
}

const input = { opportunityId: '507f1f77bcf86cd799439011', opportunityType: 'JOB' as const };

describe('explainJobMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isConfigured.mockReturnValue(false);
    computeSkillGap.mockResolvedValue(analysis());
  });

  describe('without Gemini configured', () => {
    it('still returns a complete analysis instead of failing', async () => {
      const result = await explainJobMatch('user-1', input);

      expect(result.requiredSkills.map((s) => s.name)).toEqual(['python', 'sql', 'react']);
      expect(result.matchedSkills.map((s) => s.name)).toEqual(['python', 'sql']);
      expect(result.missingSkills.map((s) => s.name)).toEqual(['react']);
      expect(result.matchPercentage).toBe(67);
      expect(result.score).toBe(67);
      expect(result.level).toBe('GOOD_MATCH');
      expect(result.narrative.length).toBeGreaterThan(0);
    });

    it('never calls the AI provider', async () => {
      await explainJobMatch('user-1', input);
      expect(generateContent).not.toHaveBeenCalled();
    });

    it('flags the result as not AI-enhanced so nothing is passed off as AI output', async () => {
      const result = await explainJobMatch('user-1', input);
      expect(result.aiEnhanced).toBe(false);
      expect(result.aiUnavailableReason).toBe('NOT_CONFIGURED');
    });

    it('writes a narrative built only from the computed numbers', async () => {
      const result = await explainJobMatch('user-1', input);
      expect(result.narrative).toContain('2 of 3');
      expect(result.narrative).toContain('67%');
      expect(result.narrative).toContain('react');
      // Nothing outside the supplied skills may appear.
      expect(result.narrative).not.toContain('kubernetes');
    });

    it('keeps the legacy name-only arrays populated', async () => {
      const result = await explainJobMatch('user-1', input);
      expect(result.matched).toEqual(['python', 'sql']);
      expect(result.missing).toEqual(['react']);
    });
  });

  describe('with Gemini configured and working', () => {
    beforeEach(() => {
      isConfigured.mockReturnValue(true);
      generateContent.mockResolvedValue({ response: { text: () => '  You are a strong fit.  ' } });
    });

    it('returns the AI narrative, trimmed and flagged', async () => {
      const result = await explainJobMatch('user-1', input);
      expect(result.narrative).toBe('You are a strong fit.');
      expect(result.aiEnhanced).toBe(true);
      expect(result.aiUnavailableReason).toBeUndefined();
    });

    it('leaves the deterministic numbers untouched by the AI response', async () => {
      const result = await explainJobMatch('user-1', input);
      expect(result.matchPercentage).toBe(67);
      expect(result.score).toBe(67);
      expect(result.missingSkills.map((s) => s.name)).toEqual(['react']);
    });

    it('only shows the AI the skills that were actually computed', async () => {
      await explainJobMatch('user-1', input);
      const prompt = String(generateContent.mock.calls[0]?.[0]);
      expect(prompt).toContain('python, sql');
      expect(prompt).toContain('react');
      expect(prompt).toContain('do not introduce any other skill');
    });
  });

  describe('when Gemini fails', () => {
    beforeEach(() => {
      isConfigured.mockReturnValue(true);
    });

    it('falls back to the deterministic analysis rather than erroring', async () => {
      generateContent.mockRejectedValue(new Error('permission denied for project 12345'));

      const result = await explainJobMatch('user-1', input);

      expect(result.aiEnhanced).toBe(false);
      expect(result.aiUnavailableReason).toBe('REQUEST_FAILED');
      expect(result.matchPercentage).toBe(67);
      expect(result.missingSkills.map((s) => s.name)).toEqual(['react']);
      expect(result.narrative.length).toBeGreaterThan(0);
    });

    it('does not leak the provider error or key material into the response', async () => {
      generateContent.mockRejectedValue(
        new Error('request to https://generativelanguage.googleapis.com/v1?key=SECRET123 failed'),
      );

      const result = await explainJobMatch('user-1', input);
      const serialized = JSON.stringify(result);

      expect(serialized).not.toContain('SECRET123');
      expect(serialized).not.toContain('googleapis');
      expect(serialized).not.toContain('key=');
    });

    it('treats an empty AI narrative as a failure and falls back', async () => {
      generateContent.mockResolvedValue({ response: { text: () => '   ' } });

      const result = await explainJobMatch('user-1', input);

      expect(result.aiEnhanced).toBe(false);
      expect(result.narrative.trim().length).toBeGreaterThan(0);
    });

    it('falls back when the provider returns a malformed response', async () => {
      generateContent.mockResolvedValue({});
      const result = await explainJobMatch('user-1', input);
      expect(result.aiEnhanced).toBe(false);
      expect(result.matchPercentage).toBe(67);
    });
  });

  describe('edge cases in the analysis it is handed', () => {
    beforeEach(() => {
      isConfigured.mockReturnValue(false);
    });

    it('describes an opportunity with no required skills without dividing by zero', async () => {
      computeSkillGap.mockResolvedValue(
        analysis({
          requiredSkills: [],
          matchedSkills: [],
          missingSkills: [],
          matchPercentage: 100,
          score: 100,
          level: 'STRONG_MATCH',
        }),
      );

      const result = await explainJobMatch('user-1', input);

      expect(result.matchPercentage).toBe(100);
      expect(result.narrative).toContain('does not list any required skills');
      expect(result.narrative).not.toContain('NaN');
    });

    it('tells a student with no recorded skills what the comparison was based on', async () => {
      computeSkillGap.mockResolvedValue(
        analysis({
          matchedSkills: [],
          missingSkills: [
            { id: '1', name: 'python' },
            { id: '2', name: 'sql' },
            { id: '3', name: 'react' },
          ],
          studentSkillCount: 0,
          matchPercentage: 0,
          score: 0,
          level: 'LOW_MATCH',
        }),
      );

      const result = await explainJobMatch('user-1', input);

      expect(result.matchPercentage).toBe(0);
      expect(result.narrative).toContain('0 of 3');
      expect(result.narrative).not.toContain('NaN');
    });

    it('mentions preferred skills only when the posting lists them', async () => {
      computeSkillGap.mockResolvedValue(
        analysis({
          preferredSkills: [{ id: '9', name: 'docker' }],
          preferredMatched: [],
        }),
      );

      const result = await explainJobMatch('user-1', input);
      expect(result.narrative).toContain('preferred');
    });
  });
});
