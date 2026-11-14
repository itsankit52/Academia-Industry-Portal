import { describe, expect, it } from 'vitest';
import { classifyGoogleTokenError } from '../googleTokenErrors';

// Messages copied from google-auth-library's oauth2client.js, including the
// payload/token it appends.
const PAYLOAD = '{"sub":"123","email":"a@b.test","name":"Expired Audience"}';

describe('classifyGoogleTokenError', () => {
  it.each([
    [`Token used too late, 1700000400 > 1700000000: ${PAYLOAD}`, 'expired'],
    [`Token used too early, 1700000000 < 1700000400: ${PAYLOAD}`, 'not_yet_valid'],
    ['Wrong recipient, payload audience != requiredAudience', 'wrong_audience'],
    ['Invalid issuer, expected one of [accounts.google.com], but got evil', 'wrong_issuer'],
    ['Invalid token signature: eyJhbGciOi.eyJzdWIi.c2ln', 'invalid_signature'],
    ['No pem found for envelope: {"alg":"RS256","kid":"x"}', 'unknown_signing_key'],
    ['Wrong number of segments in token: abc', 'malformed'],
    ["Can't parse token envelope: abc", 'malformed'],
    [`No issue time in token: ${PAYLOAD}`, 'malformed'],
    [`Expiration time too far in future: ${PAYLOAD}`, 'malformed'],
    ['The verifyIdToken method requires an ID Token', 'malformed'],
    ['jwt expired', 'expired'],
    ['something nobody anticipated', 'unknown'],
  ])('%s → %s', (message, reason) => {
    expect(classifyGoogleTokenError(new Error(message))).toBe(reason);
  });

  it('lets the message prefix win over words inside the appended payload', () => {
    expect(classifyGoogleTokenError(new Error(`No expiration time in token: ${PAYLOAD}`))).toBe(
      'malformed',
    );
  });

  it('treats certificate-fetch network errors as verifier_unavailable', () => {
    const err = Object.assign(new Error('getaddrinfo ENOTFOUND www.googleapis.com'), {
      code: 'ENOTFOUND',
    });
    expect(classifyGoogleTokenError(err)).toBe('verifier_unavailable');
  });

  it('tolerates non-Error values', () => {
    expect(classifyGoogleTokenError(undefined)).toBe('unknown');
    expect(classifyGoogleTokenError('Token used too late')).toBe('unknown');
  });
});
