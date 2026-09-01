/**
 * E2E test credentials.
 *
 * These are NOT demo accounts — they are test-environment credentials that
 * must exist in the database before running e2e tests.
 *
 * How to provision them:
 *   1. Register a STUDENT account via the real signup flow (or via a test setup
 *      script) and set STUDENT_EMAIL / STUDENT_PASSWORD in your test .env.
 *   2. Register a COMPANY account similarly for COMPANY credentials.
 *   3. Create an ADMIN user via the admin seed or a direct DB script and set
 *      ADMIN_EMAIL / ADMIN_PASSWORD.
 *
 * Environment variables override the defaults. The defaults below are
 * intentionally placeholder values that will cause e2e tests to fail until
 * real test accounts are provisioned — this is by design so that tests never
 * accidentally pass against missing or stale data.
 *
 * For local development, create a `.env.test` in apps/web/e2e/ with:
 *   VITE_E2E_STUDENT_EMAIL=student@yourtest.edu
 *   VITE_E2E_STUDENT_PASSWORD=<your-password>
 *   VITE_E2E_COMPANY_EMAIL=company@yourtest.com
 *   VITE_E2E_COMPANY_PASSWORD=<your-password>
 *   VITE_E2E_ADMIN_EMAIL=admin@yourtest.com
 *   VITE_E2E_ADMIN_PASSWORD=<your-password>
 */

export const STUDENT = {
  email: process.env['VITE_E2E_STUDENT_EMAIL'] ?? 'e2e-student@placeholder.invalid',
  password: process.env['VITE_E2E_STUDENT_PASSWORD'] ?? 'placeholder-must-be-set',
} as const;

export const COMPANY = {
  email: process.env['VITE_E2E_COMPANY_EMAIL'] ?? 'e2e-company@placeholder.invalid',
  password: process.env['VITE_E2E_COMPANY_PASSWORD'] ?? 'placeholder-must-be-set',
} as const;

export const ADMIN = {
  email: process.env['VITE_E2E_ADMIN_EMAIL'] ?? 'e2e-admin@placeholder.invalid',
  password: process.env['VITE_E2E_ADMIN_PASSWORD'] ?? 'placeholder-must-be-set',
} as const;

export type Credentials = { email: string; password: string };
