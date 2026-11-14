import { describe, expect, it } from 'vitest';
import { productionConfigWarnings } from '../env';

const live = {
  NODE_ENV: 'production' as const,
  API_URL: 'https://academia7.onrender.com',
  FRONTEND_URL: 'https://aip-qq08.onrender.com',
  COOKIE_SAMESITE: 'none' as const,
  GOOGLE_CLIENT_ID: 'x.apps.googleusercontent.com',
};

describe('productionConfigWarnings', () => {
  it('is silent for the deployed configuration (cross-site, SameSite=None, client ID set)', () => {
    expect(productionConfigWarnings(live)).toEqual([]);
  });

  it.each(['lax', 'strict'] as const)(
    'flags SameSite=%s across two *.onrender.com hosts (public suffix → cross-site)',
    (sameSite) => {
      const [w] = productionConfigWarnings({ ...live, COOKIE_SAMESITE: sameSite });
      expect(w).toMatch(/set COOKIE_SAMESITE=none/);
    },
  );

  it('does not flag lax when frontend and API share a host', () => {
    expect(
      productionConfigWarnings({
        ...live,
        API_URL: 'https://aip-qq08.onrender.com',
        COOKIE_SAMESITE: 'lax',
      }),
    ).toEqual([]);
  });

  it('flags a missing GOOGLE_CLIENT_ID without exposing any value', () => {
    expect(productionConfigWarnings({ ...live, GOOGLE_CLIENT_ID: '' })).toEqual([
      'GOOGLE_CLIENT_ID is not set: Google sign-in, signup and linking are disabled.',
    ]);
  });

  it('never warns outside production', () => {
    expect(
      productionConfigWarnings({
        ...live,
        NODE_ENV: 'development',
        COOKIE_SAMESITE: 'lax',
        GOOGLE_CLIENT_ID: '',
      }),
    ).toEqual([]);
  });
});
