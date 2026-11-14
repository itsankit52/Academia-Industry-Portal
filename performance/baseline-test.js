// 2. Low-load baseline — 1 VU, one request every ~3 s for 2 minutes
// (~35–40 requests, well inside the anonymous per-IP budget). Expect zero 429s.
//
//   k6 run -e BASE_URL=http://localhost:4000 performance/baseline-test.js
import { sleep } from 'k6';
import { checkJobsResponse, getJobs, guardProduction } from './lib.js';

// Init-time guard: runs before any request and cannot be skipped by --no-setup.
guardProduction('baseline-test');

export const options = {
  vus: 1,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
    rate_limited_429: ['count==0'],
  },
};

export default function () {
  checkJobsResponse(getJobs());
  sleep(3);
}
