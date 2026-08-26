import { test as base, expect } from '@playwright/test';

const BACKEND_URL = process.env['E2E_API_URL'] ?? 'http://localhost:4000';
const HEALTH_PATH = '/api/v1/health';
const SKIP_MSG = 'Backend not running — start with `pnpm dev` and run `pnpm seed` first';

let cached: boolean | null = null;

async function checkBackend(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const res = await fetch(`${BACKEND_URL}${HEALTH_PATH}`);
    cached = res.ok;
  } catch {
    cached = false;
  }
  return cached;
}

type Fixtures = { ensureBackend: void };

export const test = base.extend<Fixtures>({
  ensureBackend: [
    async ({}, use) => {
      const ok = await checkBackend();
      if (!ok) test.skip(true, SKIP_MSG);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
