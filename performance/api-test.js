// 1. Single-request verification — one GET of the jobs listing.
// Deliberately unguarded: one request is safe against production. Prints the
// rate-limit headers for this client IP.
//
//   k6 run -e BASE_URL=https://academia7.onrender.com performance/api-test.js
import { checkJobsResponse, getJobs, rateLimitHeaders } from './lib.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1'] },
};

export default function () {
  const res = getJobs('60s'); // Render free tier may need a cold start
  console.info(
    `status=${res.status} duration=${res.timings.duration.toFixed(0)}ms ${rateLimitHeaders(res)}`,
  );
  checkJobsResponse(res);
}
