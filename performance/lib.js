/* global __ENV */
// Shared helpers for the k6 scripts in this directory.
//
// Target: BASE_URL (default http://localhost:4000). Scripts that put sustained
// load on the API call guardProduction() at INIT time (module scope, not
// setup()), so `k6 run --no-setup` cannot skip it. They refuse to run against
// production unless ALLOW_PRODUCTION=1 is set explicitly. Prefer staging or a
// local API. Note: k6 also reads OS environment variables into __ENV, so do
// not export ALLOW_PRODUCTION permanently in your shell profile.
//
// Rate limits (apps/api/src/middleware/rateLimit.ts): anonymous traffic is
// counted per client IP, so every k6 VU on one machine shares ONE budget
// (RATE_LIMIT_MAX_REQUESTS per RATE_LIMIT_WINDOW_MS, default 300 / 15 min).
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

export const PRODUCTION_HOSTS = ['academia7.onrender.com'];
export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:4000').trim().replace(/\/+$/, '');
export const JOBS_PATH = '/api/v1/jobs?page=1&pageSize=12';

if (!/^https?:\/\/[^/]+/i.test(BASE_URL)) {
  throw new Error(`BASE_URL must be an absolute http(s) URL, got "${BASE_URL}"`);
}

/** Lower-cased host of BASE_URL without port or trailing dot (k6 has no URL global). */
export function baseHost(url = BASE_URL) {
  const m = /^https?:\/\/(?:[^@/]*@)?([^/:?#]+)/i.exec(url);
  return m ? m[1].toLowerCase().replace(/\.$/, '') : '';
}

export const IS_PRODUCTION = PRODUCTION_HOSTS.includes(baseHost());

export function guardProduction(scriptName) {
  if (IS_PRODUCTION && __ENV.ALLOW_PRODUCTION !== '1') {
    throw new Error(
      `${scriptName}: refusing to load-test production (${BASE_URL}). ` +
        'Use a staging/local BASE_URL, or set ALLOW_PRODUCTION=1 deliberately.',
    );
  }
}

// k6 canonicalises header names (Go style): "Ratelimit-Limit", not "RateLimit-Limit".
export function rateLimitHeaders(res) {
  return (
    `limit=${res.headers['Ratelimit-Limit']} policy=${res.headers['Ratelimit-Policy']} ` +
    `remaining=${res.headers['Ratelimit-Remaining']} reset=${res.headers['Ratelimit-Reset']}s`
  );
}

/** Parses the body as JSON; undefined when it is not JSON. */
export function jsonBody(res) {
  try {
    return JSON.parse(res.body);
  } catch {
    return undefined;
  }
}

export const rateLimited = new Counter('rate_limited_429');

export function getJobs(timeout = '30s') {
  return http.get(`${BASE_URL}${JOBS_PATH}`, { tags: { endpoint: 'jobs-listing' }, timeout });
}

export function checkJobsResponse(res) {
  if (res.status === 429) {
    rateLimited.add(1);
    console.warn(`429 ${rateLimitHeaders(res)} retry-after=${res.headers['Retry-After']}s`);
  }
  const body = jsonBody(res);
  return check(res, {
    'status is 200': (r) => r.status === 200,
    'success is true': () => body?.success === true,
    'jobs list present': () => Array.isArray(body?.data?.items),
  });
}
