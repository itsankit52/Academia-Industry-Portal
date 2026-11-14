/**
 * The linking request against the real axios client (only the transport is
 * replaced), so the wire contract the backend's Phase 1 guards depend on is
 * asserted: POST, JSON body, cookies sent. Plus the status → UI mapping.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { api } from '@/lib/api';
import { ApiClientError } from '@/lib/ApiClientError';
import { describeLinkError, linkGoogleAccount } from '../useLinkGoogleAccount';

describe('linkGoogleAccount request', () => {
  const originalAdapter = api.defaults.adapter;
  let seen: InternalAxiosRequestConfig | undefined;

  beforeEach(() => {
    seen = undefined;
    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      seen = config;
      return {
        data: { success: true, data: { user: { id: 'u1', authProvider: 'both' } } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    }) as AxiosAdapter;
  });
  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('POSTs JSON { idToken, currentPassword } with credentials to /auth/google/link', async () => {
    const result = await linkGoogleAccount({ idToken: 'a.b.c', currentPassword: 'Secret@123' });

    expect(seen?.method).toBe('post');
    expect(seen?.url).toBe('/auth/google/link');
    expect(seen?.withCredentials).toBe(true);
    expect(String(seen?.headers?.['Content-Type'])).toMatch(/^application\/json/);
    expect(JSON.parse(String(seen?.data))).toEqual({
      idToken: 'a.b.c',
      currentPassword: 'Secret@123',
    });
    expect(result.user.authProvider).toBe('both');
  });
});

describe('describeLinkError', () => {
  const err = (status: number, message: string) =>
    new ApiClientError('X', message, undefined, status);

  it.each([
    [
      err(400, 'currentPassword is required to link a Google account'),
      'password',
      'Enter your current password.',
    ],
    [err(403, 'Password confirmation failed'), 'password', 'Current password is incorrect.'],
    [
      err(401, 'Google sign-in session has expired. Please sign in again.'),
      'google',
      'Google sign-in session has expired. Please sign in again.',
    ],
    [
      err(401, 'Google sign-in failed. Please try again.'),
      'google',
      'Google sign-in failed. Please try again.',
    ],
    [err(401, 'Authentication required'), 'session', /session has ended/],
    [err(401, 'Invalid session'), 'session', /session has ended/],
    [
      err(409, 'This Google account is already linked to a different AcadIn account.'),
      'google',
      'This Google account is already linked to a different AcadIn account.',
    ],
    [
      err(409, 'Your AcadIn account is already linked to a different Google account.'),
      'google',
      'Your AcadIn account is already linked to a different Google account.',
    ],
    [err(403, 'Cross-origin request rejected'), 'form', 'Cross-origin request rejected'],
    [err(415, 'Content-Type must be application/json'), 'form', /expected format/],
    [err(429, 'Too many requests'), 'form', /Too many attempts/],
    [new Error('Network Error'), 'form', /Could not reach AcadIn/],
  ])('%s → %s', (error, target, message) => {
    const failure = describeLinkError(error);
    expect(failure.target).toBe(target);
    if (typeof message === 'string') expect(failure.message).toBe(message);
    else expect(failure.message).toMatch(message);
  });
});
