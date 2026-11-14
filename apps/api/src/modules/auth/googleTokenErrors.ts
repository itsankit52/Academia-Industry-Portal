/**
 * Classification of Google ID-token verification failures.
 *
 * google-auth-library reports every failure as a plain `Error` whose message
 * often embeds the raw token ("Invalid token signature: <jwt>") or the decoded
 * payload with the user's email and name ("Token used too late, … : {…}").
 * Those messages must never reach logs or clients. This module reduces them to
 * a fixed reason code, which is what callers log and map to a response.
 *
 * Patterns match the library's own message prefixes (v9, oauth2client.js
 * `verifySignedJwtWithCertsAsync` / `verifyIdTokenAsync`).
 */

export type GoogleTokenFailureReason =
  | 'expired'
  | 'not_yet_valid'
  | 'wrong_audience'
  | 'wrong_issuer'
  | 'invalid_signature'
  | 'unknown_signing_key'
  | 'malformed'
  | 'missing_subject'
  | 'verifier_unavailable'
  | 'unknown';

const RULES: ReadonlyArray<[RegExp, GoogleTokenFailureReason]> = [
  // "Token used too late, <now> > <latest>: <payload>"
  [/^Token used too late\b/i, 'expired'],
  // "Token used too early, <now> < <earliest>: <payload>"
  [/^Token used too early\b/i, 'not_yet_valid'],
  // "Wrong recipient, payload audience != requiredAudience"
  [/^Wrong recipient\b/i, 'wrong_audience'],
  // "Invalid issuer, expected one of [...], but got <iss>"
  [/^Invalid issuer\b/i, 'wrong_issuer'],
  // "Invalid token signature: <jwt>"
  [/^Invalid token signature\b/i, 'invalid_signature'],
  // "No pem found for envelope: <header>"
  [/^No pem found for envelope\b/i, 'unknown_signing_key'],
  // Structural problems with the JWT or its claims.
  [
    /^(Wrong number of segments|Can't parse token|No issue time|No expiration time|Expiration time too far|iat field|exp field|The verifyIdToken method requires)/i,
    'malformed',
  ],
  // Generic fallbacks, checked last: several library messages append the
  // decoded payload, whose user-controlled fields (e.g. a name) must not
  // decide the classification ahead of the message prefix.
  [/\bexpired\b/i, 'expired'],
  [/\baudience\b/i, 'wrong_audience'],
];

/** Network-level failures fetching Google's certificates. */
const NETWORK_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
]);

export function classifyGoogleTokenError(err: unknown): GoogleTokenFailureReason {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && NETWORK_CODES.has(code)) return 'verifier_unavailable';
  const message = String((err as { message?: unknown } | null)?.message ?? '');
  for (const [pattern, reason] of RULES) {
    if (pattern.test(message)) return reason;
  }
  return 'unknown';
}
