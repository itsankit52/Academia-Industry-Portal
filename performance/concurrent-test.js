// 3. Controlled concurrency — ramps to 5 VUs with 2 s think time. Roughly
// 140–190 requests in total (depends on latency), under the default anonymous
// per-IP budget of 300 / 15 min. All VUs share one IP: running it twice inside
// 15 minutes WILL produce 429s by design — wait for RateLimit-Reset or restart
// the local API.
//
//   k6 run -e BASE_URL=http://localhost:4000 performance/concurrent-test.js
import { sleep } from 'k6';
import { checkJobsResponse, getJobs, guardProduction } from './lib.js';

// Init-time guard: runs before any request and cannot be skipped by --no-setup.
guardProduction('concurrent-test');

export const options = {
  stages: [
    { duration: '20s', target: 5 },
    { duration: '60s', target: 5 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    rate_limited_429: ['count==0'],
  },
};

export default function () {
  checkJobsResponse(getJobs());
  sleep(2);
}
