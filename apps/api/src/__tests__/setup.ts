process.env.NODE_ENV ??= 'test';
process.env.API_URL ??= 'http://localhost:4000';
process.env.FRONTEND_URL ??= 'http://localhost:3000';
process.env.MONGODB_URI ??=
  process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/aip_test_placeholder';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-please-override-32chars-min';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-please-override-32chars-min';
process.env.COOKIE_DOMAIN ??= 'localhost';
process.env.LOG_LEVEL ??= 'silent';
// Fixed test audience so Google-token suites never depend on a developer's .env.
process.env.GOOGLE_CLIENT_ID ??= 'test-client-id.apps.googleusercontent.com';

// In-process TTL caches (e.g. the 60 s recommendation data cache) must not leak
// one test's mocked data into the next. ttlCache.ts imports no models, so this
// does not interfere with per-file vi.mock('../models').
import { beforeEach } from 'vitest';
import { clearAllTtlCaches } from '../utils/ttlCache';

beforeEach(() => clearAllTtlCaches());
