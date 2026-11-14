import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { vi } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';

/**
 * Mint Google-shaped ID tokens that google-auth-library's real verifier
 * accepts. Only the certificate download is redirected (`useTestGoogleCerts`)
 * to a key pair generated for this process; signature, audience, issuer and
 * expiry checks all run unmodified.
 */
const KID = 'test-google-kid';
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

/** Call in beforeEach; undo with vi.restoreAllMocks() in afterEach. */
export function useTestGoogleCerts(): void {
  vi.spyOn(OAuth2Client.prototype, 'getFederatedSignonCertsAsync').mockResolvedValue({
    certs: { [KID]: PUBLIC_PEM },
    format: 'PEM',
  } as never);
}

export function googleIdToken(sub: string, claims: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: 'https://accounts.google.com',
      aud: env.GOOGLE_CLIENT_ID,
      sub,
      email: `${sub}@example.test`,
      email_verified: true,
      name: `Name ${sub}`,
      iat: now - 5,
      exp: now + 3600,
      ...claims,
    },
    PRIVATE_PEM,
    { algorithm: 'RS256', keyid: KID },
  );
}
