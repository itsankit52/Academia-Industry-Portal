/**
 * Model ids Google has retired. Kept in its own module, with no imports, so the
 * check can be unit-tested without pulling in `config/env` — which validates the
 * whole environment at import time and calls `process.exit(1)` on failure.
 */
const RETIRED_GEMINI_MODELS = new Set([
  'gemini-1.0-pro',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-pro-vision',
]);

/** The id this project targets, and the default in `config/env`. */
export const RECOMMENDED_GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * A retired id is not a startup-blocking problem: every AI path here already
 * degrades to a deterministic result, so the portal keeps working. The trouble is
 * that it degrades *silently* — Gemini answers 404 for the retired model, the
 * fallback quietly takes over, and it looks like the AI merely had nothing to
 * add. `.env.example` used to ship `gemini-1.5-flash`, so anyone who followed the
 * documented setup inherited exactly that. Worth shouting about at boot.
 *
 * Values arrive straight from the environment, so casing and stray whitespace are
 * normalized before comparing.
 */
export function isRetiredGeminiModel(model: string | undefined): boolean {
  if (typeof model !== 'string') return false;
  return RETIRED_GEMINI_MODELS.has(model.trim().toLowerCase());
}

/**
 * Turns the raw environment value into the id to actually send to Google.
 *
 * A Zod `.default()` only fires on `undefined`, but a `GEMINI_MODEL=` line with
 * nothing after it parses as `''` — which is a perfectly valid string, so it
 * would sail through and end up in `getGenerativeModel({ model: '' })`. That
 * request fails, the deterministic fallback takes over without comment, and the
 * result is indistinguishable from the AI having nothing to add: the exact
 * silent-degradation trap a pinned model id is meant to prevent. Whitespace-only
 * values behave the same way, so both collapse back to the recommended id here.
 */
export function resolveGeminiModel(model: string | undefined): string {
  return (model ?? '').trim() || RECOMMENDED_GEMINI_MODEL;
}
