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
    preferredSkills: [
      { id: '4', name: 'docker' },
      { id: '5', name: 'kubernetes' },
    ],
    preferredMatched: [{ id: '4', name: 'docker' }],
    studentSkillCount: 3,
    matchPercentage: 67,
    score: 67,
    level: 'GOOD_MATCH',
    recommendation: 'Good fit — you meet most core requirements.',
    ...overrides,
  };
}

const input = { opportunityId: '507f1f77bcf86cd799439011', opportunityType: 'JOB' as const };

// Valid JSON response Gemini should return
const VALID_AI_JSON = JSON.stringify({
  skillGaps: ['react', 'typescript'],
  strengths: ['python proficiency', 'sql expertise', 'docker knowledge'],
  recommendedSkills: ['react', 'typescript', 'aws basics'],
  matchExplanation:
    'You are a strong match for backend work with solid Python and SQL foundations. The main gap is React, which is essential for the full-stack component of the role. Building proficiency in React would significantly improve your standing.',
});

// Valid JSON wrapped in a code block
const VALID_AI_CODEBLOCK = '```json\n' + VALID_AI_JSON + '\n```';

// A response that is not JSON at all
const NON_JSON_RESPONSE = 'You are a good match for this role!';

describe('explainJobMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isConfigured.mockReturnValue(false);
    computeSkillGap.mockResolvedValue(analysis());
  });

  // -------------------------------------------------------------------------
  // Fallback — Gemini not configured
  // -------------------------------------------------------------------------
  describe('when Gemini is not configured', () => {
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

    it('flags the result as not AI-enhanced', async () => {
      const result = await explainJobMatch('user-1', input);
      expect(result.aiEnhanced).toBe(false);
      expect(result.aiUnavailableReason).toBe('NOT_CONFIGURED');
    });

    it('computes aiAnalysis from math when Gemini is unavailable', async () => {
      const result = await explainJobMatch('user-1', input);
      expect(result.aiAnalysis).toBeDefined();
      expect(result.aiAnalysis.skillGaps).toEqual(['react']);
      expect(result.aiAnalysis.strengths).toEqual(['python', 'sql']);
      expect(result.aiAnalysis.recommendedSkills).toEqual(['react']);
      expect(result.aiAnalysis.matchExplanation.length).toBeGreaterThan(0);
    });

    it('writes a narrative built only from the computed numbers', async () => {
      const result = await explainJobMatch('user-1', input);
      expect(result.narrative).toContain('2 of 3');
      expect(result.narrative).toContain('67%');
      expect(result.narrative).toContain('react');
      expect(result.narrative).not.toContain('kubernetes');
    });

    it('keeps the legacy name-only arrays populated', async () => {
      const result = await explainJobMatch('user-1', input);
      expect(result.matched).toEqual(['python', 'sql']);
      expect(result.missing).toEqual(['react']);
    });
  });

  // -------------------------------------------------------------------------
  // Successful AI response
  // -------------------------------------------------------------------------
  describe('when Gemini is configured and returns valid structured JSON', () => {
    beforeEach(() => {
      isConfigured.mockReturnValue(true);
      generateContent.mockResolvedValue({ response: { text: () => VALID_AI_CODEBLOCK } });
    });

    it('returns the AI analysis, flagged as enhanced', async () => {
      const result = await explainJobMatch('user-1', input);
      expect(result.aiEnhanced).toBe(true);
      expect(result.aiUnavailableReason).toBeUndefined();
    });

    it('populates all four aiAnalysis fields from the JSON', async () => {
      const result = await explainJobMatch('user-1', input);
      expect(result.aiAnalysis.skillGaps).toEqual(['react', 'typescript']);
      expect(result.aiAnalysis.strengths).toEqual([
        'python proficiency',
        'sql expertise',
        'docker knowledge',
      ]);
      expect(result.aiAnalysis.recommendedSkills).toEqual(['react', 'typescript', 'aws basics']);
      expect(result.aiAnalysis.matchExplanation).toContain('strong match');
    });

    it('uses aiAnalysis.matchExplanation as the narrative', async () => {
      const result = await explainJobMatch('user-1', input);
      expect(result.narrative).toContain('strong match');
    });

    it('leaves the deterministic numbers untouched', async () => {
      const result = await explainJobMatch('user-1', input);
      expect(result.matchPercentage).toBe(67);
      expect(result.score).toBe(67);
      expect(result.missingSkills.map((s) => s.name)).toEqual(['react']);
    });

    it('sends the full context to Gemini including preferred skills', async () => {
      await explainJobMatch('user-1', input);
      const prompt = String(generateContent.mock.calls[0]?.[0]);
      expect(prompt).toContain('python, sql');
      expect(prompt).toContain('react');
      expect(prompt).toContain('docker');
      expect(prompt).toContain('kubernetes');
    });

    it('handles bare JSON without code fences', async () => {
      generateContent.mockResolvedValue({ response: { text: () => VALID_AI_JSON } });
      const result = await explainJobMatch('user-1', input);
      expect(result.aiEnhanced).toBe(true);
      expect(result.aiAnalysis.skillGaps).toEqual(['react', 'typescript']);
    });
  });

  // -------------------------------------------------------------------------
  // AI failure
  // -------------------------------------------------------------------------
  describe('when Gemini request fails', () => {
    beforeEach(() => {
      isConfigured.mockReturnValue(true);
    });

    it('falls back to the deterministic analysis rather than erroring', async () => {
      generateContent.mockRejectedValue(new Error('permission denied for project 12345'));

      const result = await explainJobMatch('user-1', input);

      expect(result.aiEnhanced).toBe(false);
      expect(result.aiUnavailableReason).toBe('REQUEST_FAILED');
      expect(result.matchPercentage).toBe(67);
      expect(result.aiAnalysis.skillGaps).toEqual(['react']);
      expect(result.aiAnalysis.strengths).toEqual(['python', 'sql']);
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

    it('treats an empty AI response as a failure and falls back', async () => {
      generateContent.mockResolvedValue({ response: { text: () => '   ' } });

      const result = await explainJobMatch('user-1', input);

      expect(result.aiEnhanced).toBe(false);
      expect(result.aiUnavailableReason).toBe('REQUEST_FAILED');
      expect(result.aiAnalysis.skillGaps).toEqual(['react']);
    });

    it('treats a malformed response object as a failure and falls back', async () => {
      generateContent.mockResolvedValue({});
      const result = await explainJobMatch('user-1', input);
      expect(result.aiEnhanced).toBe(false);
      expect(result.matchPercentage).toBe(67);
      expect(result.aiAnalysis.skillGaps).toEqual(['react']);
    });

    it('falls back when Gemini times out', async () => {
      generateContent.mockRejectedValue(new Error('Gemini request timed out after 20000ms'));
      const result = await explainJobMatch('user-1', input);
      expect(result.aiEnhanced).toBe(false);
      expect(result.aiUnavailableReason).toBe('REQUEST_FAILED');
      expect(result.aiAnalysis.skillGaps).toEqual(['react']);
    });
  });

  // -------------------------------------------------------------------------
  // Invalid AI response
  // -------------------------------------------------------------------------
  describe('when Gemini returns an invalid JSON response', () => {
    beforeEach(() => {
      isConfigured.mockReturnValue(true);
    });

    it('falls back when the response is not JSON', async () => {
      generateContent.mockResolvedValue({
        response: { text: () => NON_JSON_RESPONSE },
      });

      const result = await explainJobMatch('user-1', input);

      expect(result.aiEnhanced).toBe(false);
      expect(result.aiUnavailableReason).toBe('REQUEST_FAILED');
      expect(result.matchPercentage).toBe(67);
      expect(result.aiAnalysis.skillGaps).toEqual(['react']);
    });

    it('falls back when the JSON has the wrong structure (skillGaps is not an array)', async () => {
      generateContent.mockResolvedValue({
        response: {
          text: () =>
            '```json\n{"skillGaps": "not an array", "strengths": [], "recommendedSkills": [], "matchExplanation": ""}\n```',
        },
      });

      const result = await explainJobMatch('user-1', input);

      expect(result.aiEnhanced).toBe(false);
      expect(result.aiUnavailableReason).toBe('REQUEST_FAILED');
      expect(result.aiAnalysis.skillGaps).toEqual(['react']);
    });

    it('falls back when the JSON has an extra unknown field', async () => {
      generateContent.mockResolvedValue({
        response: {
          text: () =>
            '```json\n{"skillGaps": ["react"], "strengths": ["python"], "recommendedSkills": ["typescript"], "matchExplanation": "Good fit.", "unknownField": "should be ignored"}\n```',
        },
      });

      const result = await explainJobMatch('user-1', input);

      expect(result.aiEnhanced).toBe(true);
      expect(result.aiAnalysis.skillGaps).toEqual(['react']);
      expect(result.aiAnalysis.strengths).toEqual(['python']);
    });

    it('drops blank or non-string entries from skill arrays', async () => {
      generateContent.mockResolvedValue({
        response: {
          text: () =>
            '```json\n{"skillGaps": ["react", "", "  ", "typescript"], "strengths": [], "recommendedSkills": null, "matchExplanation": "Good."}\n```',
        },
      });

      const result = await explainJobMatch('user-1', input);

      expect(result.aiEnhanced).toBe(true);
      expect(result.aiAnalysis.skillGaps).toEqual(['react', 'typescript']);
      expect(result.aiAnalysis.strengths).toEqual([]);
      expect(result.aiAnalysis.recommendedSkills).toEqual([]);
    });

    it('uses deterministic narrative as fallback when matchExplanation is blank', async () => {
      generateContent.mockResolvedValue({
        response: {
          text: () =>
            '```json\n{"skillGaps": ["react"], "strengths": ["python"], "recommendedSkills": ["typescript"], "matchExplanation": "   "}\n```',
        },
      });

      const result = await explainJobMatch('user-1', input);

      expect(result.aiEnhanced).toBe(true);
      expect(result.narrative).toContain('2 of 3');
    });
  });

  // -------------------------------------------------------------------------
  // Fallback execution verification
  // -------------------------------------------------------------------------
  describe('fallback produces correct deterministic aiAnalysis', () => {
    beforeEach(() => {
      isConfigured.mockReturnValue(false);
    });

    it('maps matchedSkills to strengths and missingSkills to skillGaps + recommendedSkills', async () => {
      const result = await explainJobMatch('user-1', input);
      expect(result.aiAnalysis.strengths).toEqual(['python', 'sql']);
      expect(result.aiAnalysis.skillGaps).toEqual(['react']);
      expect(result.aiAnalysis.recommendedSkills).toEqual(['react']);
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
      expect(result.aiAnalysis.matchExplanation).toContain('does not list any required skills');
      expect(result.aiAnalysis.matchExplanation).not.toContain('NaN');
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
      expect(result.aiAnalysis.skillGaps).toEqual(['python', 'sql', 'react']);
      expect(result.aiAnalysis.strengths).toEqual([]);
    });

    it('mentions preferred skills in the narrative when the posting lists them', async () => {
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
