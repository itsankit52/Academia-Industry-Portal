/* global __ENV */
// Verifies the per-user rate-limit policies with ONE request each (3 total).
// Safe against production: neither POST can reach a Gemini call or write data —
// both bodies fail validation, which runs after the limiter counts them.
//
// The access token is read from the ACADIN_TOKEN *process environment
// variable* (k6 exposes OS env vars as __ENV). Do not pass it with -e on the
// command line (shell history / process list), and NEVER run this with
// --http-debug, which prints request headers including Authorization.
// The script itself logs only status codes and RateLimit-* headers.
//
// Use a STUDENT account (AI and assessment routes are student-only).
//
//   Windows PowerShell 5.1 (input is masked; nothing is echoed or saved):
//     $s = Read-Host "Paste access token (aip_at cookie value)" -AsSecureString
//     $env:ACADIN_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
//       [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)); Remove-Variable s
//     k6 run -e BASE_URL=https://academia7.onrender.com performance/verify-auth-limits.js
//     Remove-Item Env:ACADIN_TOKEN
//
// Budget consumed per run: 1 of 600 (global/user), 1 of 20 (AI),
// 1 of 5 per HOUR (assessment generation). Do not loop this script.
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, rateLimitHeaders } from './lib.js';

// Init-time checks (cannot be skipped by --no-setup).
// Accept a pasted "aip_at=<jwt>" or "Bearer <jwt>" and stray whitespace/quotes.
const TOKEN = (__ENV.ACADIN_TOKEN || '')
  .trim()
  .replace(/^["']|["']$/g, '')
  .replace(/^(aip_at=|Bearer\s+)/i, '');
if (!TOKEN) {
  throw new Error('ACADIN_TOKEN is not set in the environment (see header comment).');
}
if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(TOKEN)) {
  // Do not echo the value — it may still be a secret.
  throw new Error('ACADIN_TOKEN does not look like a JWT (expected three dot-separated parts).');
}

function expectedLimit(name, fallback) {
  const raw = __ENV[name];
  const n = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} must be a positive integer`);
  return n;
}

const EXPECTED = {
  user: expectedLimit('EXPECT_USER_LIMIT', 600),
  ai: expectedLimit('EXPECT_AI_LIMIT', 20),
  generate: expectedLimit('EXPECT_GENERATE_LIMIT', 5),
};

// 422 is the intended outcome of the two POST probes; do not count it as a
// failed request in k6's summary.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 422));

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1'] },
};

function send(method, path, body) {
  const params = {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    timeout: '60s',
  };
  return method === 'GET'
    ? http.get(`${BASE_URL}${path}`, params)
    : http.post(`${BASE_URL}${path}`, JSON.stringify(body), params);
}

function report(label, res) {
  console.info(
    `${label}: status=${res.status} ${rateLimitHeaders(res)} time=${res.timings.duration.toFixed(0)}ms`,
  );
}

export default function () {
  // 1. Global per-user budget on a read-only endpoint. A forged or expired
  //    token falls back to the anonymous per-IP limit, so seeing the per-user
  //    limit proves the server verified the token's signature.
  const me = send('GET', '/api/v1/auth/me');
  report('auth/me (global, per user)', me);
  const authed = check(me, {
    [`user limit is ${EXPECTED.user} (token verified)`]: (r) =>
      r.headers['Ratelimit-Limit'] === String(EXPECTED.user),
  });
  if (!authed) {
    console.error(
      'Per-user limit not applied: token invalid/expired (limit shows the anonymous value) ' +
        'or RATE_LIMIT_USER_MAX_REQUESTS differs. Skipping AI/assessment probes.',
    );
    return;
  }

  // 2. AI limiter. `message` is required, so {} fails validation (422) after
  //    the limiter counts it — no Gemini call. The AI limiter's headers
  //    overwrite the global limiter's, so Limit should read 20.
  const ai = send('POST', '/api/v1/ai/chat', {});
  report('ai/chat (AI, per user)', ai);
  check(ai, {
    'ai request rejected by validation (422)': (r) => r.status === 422,
    [`ai limit is ${EXPECTED.ai}`]: (r) => r.headers['Ratelimit-Limit'] === String(EXPECTED.ai),
  });

  // 3. Assessment generation limiter. WARNING: `{}` is a VALID body here (all
  //    fields optional) and would trigger a real Gemini generation. Two
  //    independently invalid fields (min 15 minutes; integer question count)
  //    guarantee a 422 after the limiter counts the request.
  const gen = send('POST', '/api/v1/assessments/me/generate', {
    durationMinutes: 1,
    questionCount: 'invalid',
  });
  report('assessments/me/generate (per user, hourly)', gen);
  check(gen, {
    'generate rejected by validation (422)': (r) => r.status === 422,
    [`generate limit is ${EXPECTED.generate}`]: (r) =>
      r.headers['Ratelimit-Limit'] === String(EXPECTED.generate),
    'generate window is 1 hour': (r) =>
      r.headers['Ratelimit-Policy'] === `${EXPECTED.generate};w=3600`,
  });
}
