import { describe, expect, it } from 'vitest';
import {
  RECOMMENDED_GEMINI_MODEL,
  isRetiredGeminiModel,
  resolveGeminiModel,
} from '../geminiModels';

describe('isRetiredGeminiModel', () => {
  it.each([
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
    'gemini-1.0-pro',
    'gemini-pro',
    'gemini-pro-vision',
  ])('flags the retired id %s', (model) => {
    expect(isRetiredGeminiModel(model)).toBe(true);
  });

  it.each([
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
  ])('leaves the current id %s alone', (model) => {
    expect(isRetiredGeminiModel(model)).toBe(false);
  });

  it('normalizes casing and stray whitespace, since the value comes from .env', () => {
    expect(isRetiredGeminiModel('  Gemini-1.5-Flash  ')).toBe(true);
    expect(isRetiredGeminiModel('GEMINI-1.5-PRO')).toBe(true);
  });

  it('says nothing about an unset or non-string value', () => {
    expect(isRetiredGeminiModel(undefined)).toBe(false);
    expect(isRetiredGeminiModel('')).toBe(false);
  });

  it('does not flag a substring match, only the whole id', () => {
    // A future `gemini-1.5-flash-002`-style id is not in the retired list, and
    // guessing at it would be worse than staying quiet.
    expect(isRetiredGeminiModel('gemini-1.5-flash-preview')).toBe(false);
  });

  it('never recommends an id it would then flag as retired', () => {
    expect(isRetiredGeminiModel(RECOMMENDED_GEMINI_MODEL)).toBe(false);
  });
});

describe('resolveGeminiModel', () => {
  it('keeps an explicitly configured id, trimmed', () => {
    expect(resolveGeminiModel('gemini-2.5-pro')).toBe('gemini-2.5-pro');
    expect(resolveGeminiModel('  gemini-2.5-pro  ')).toBe('gemini-2.5-pro');
  });

  it.each([undefined, '', '   ', '\t\n'])(
    'falls back to the recommended id for the blank value %j',
    (value) => {
      // A `GEMINI_MODEL=` line with nothing after it reaches Zod as '', which a
      // plain `.default()` does not replace. Left alone it would be handed to
      // `getGenerativeModel({ model: '' })`, and every AI feature would quietly
      // serve its deterministic fallback forever.
      expect(resolveGeminiModel(value)).toBe(RECOMMENDED_GEMINI_MODEL);
    },
  );

  it('does not silently repair a retired id — that is the warning path, not this one', () => {
    // Rewriting it here would hide a misconfiguration the operator should see.
    expect(resolveGeminiModel('gemini-1.5-flash')).toBe('gemini-1.5-flash');
    expect(isRetiredGeminiModel(resolveGeminiModel('gemini-1.5-flash'))).toBe(true);
  });

  it('produces a value that is never itself blank', () => {
    for (const value of [undefined, '', ' ', 'gemini-2.0-flash']) {
      expect(resolveGeminiModel(value).length).toBeGreaterThan(0);
    }
  });
});
