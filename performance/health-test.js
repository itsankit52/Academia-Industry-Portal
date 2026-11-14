// Health endpoint availability (5 VUs, 30 s). /api/v1/health is exempt from
// rate limiting, so this neither consumes nor is affected by the API budget.
//
//   k6 run -e BASE_URL=http://localhost:4000 performance/health-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, guardProduction, jsonBody } from './lib.js';

// Init-time guard: runs before any request and cannot be skipped by --no-setup.
guardProduction('health-test');

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: { checks: ['rate==1'] },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/health`, {
    tags: { endpoint: 'health' },
    timeout: '30s',
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'no rate-limit headers (exempt)': (r) => r.headers['Ratelimit-Limit'] === undefined,
    'success is true': (r) => jsonBody(r)?.success === true,
  });
  sleep(1);
}
