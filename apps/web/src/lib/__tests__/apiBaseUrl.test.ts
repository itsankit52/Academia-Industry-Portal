/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, type ConfigEnv, type UserConfig } from 'vite';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import webViteConfig from '../../../vite.config';

/**
 * Config + build-guard tests for the API base URL. These only read the
 * filesystem and call Vite's `loadEnv`, so they run in the Node environment
 * and never touch the DOM.  (The render tests that call `renderWithProviders`
 * live in apiBaseUrl.render.test.tsx where the jsdom environment is available.)
 */

// The render group mocks `apiGet`; these tests don't call it.
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

/** `apps/web`, found relative to this file so the cwd of the runner is irrelevant. */
const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const LOOPBACK = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1']);

/** The config's default export is the factory `defineConfig` was handed. */
const buildConfig = (env: ConfigEnv): UserConfig =>
  (webViteConfig as unknown as (e: ConfigEnv) => UserConfig)(env);

/** What `vite build` will inline, read the way the config reads it.

    `process.env.VITE_API_URL` may already be set (e.g. from `.env`), which takes
    precedence over file-loaded values.  Delete it first so `loadEnv` reads the
    file that Vite's own build pipeline will actually use. */
const resolveApiUrl = (mode: string): string | undefined => {
  delete process.env.VITE_API_URL;
  return loadEnv(mode, WEB_ROOT, 'VITE_').VITE_API_URL;
};

let savedApiUrl: string | undefined;

beforeEach(() => {
  savedApiUrl = process.env.VITE_API_URL;
});

afterEach(() => {
  if (savedApiUrl === undefined) delete process.env.VITE_API_URL;
  else process.env.VITE_API_URL = savedApiUrl;
});

describe('the API base URL a production build inlines', () => {
  it('points at a deployed API rather than the machine running the browser', () => {
    const apiUrl = resolveApiUrl('production');

    expect(apiUrl).toBeDefined();
    const url = new URL(apiUrl!);
    expect(LOOPBACK.has(url.hostname.toLowerCase())).toBe(false);
    expect(url.protocol).toBe('https:');
    expect(url.pathname).toBe('/api/v1');
  });

  it('still points local development at the local API', () => {
    const apiUrl = resolveApiUrl('development');

    expect(apiUrl).toBeDefined();
    expect(LOOPBACK.has(new URL(apiUrl!).hostname)).toBe(true);
  });

  it('is committed, so a build does not depend on an untracked file', () => {
    const committed = readFileSync(path.join(WEB_ROOT, '.env.production'), 'utf8');

    expect(committed).toContain('VITE_API_URL=');
    expect(committed).not.toContain('localhost');
  });
});

describe('vite build refuses an undeployable API base URL', () => {
  it('rejects a loopback URL instead of shipping it', () => {
    process.env.VITE_API_URL = 'http://localhost:4000/api/v1';

    expect(() => buildConfig({ command: 'build', mode: 'production' })).toThrow(
      /machine running the browser/,
    );
  });

  it('rejects an empty value instead of inlining undefined', () => {
    process.env.VITE_API_URL = '';

    expect(() => buildConfig({ command: 'build', mode: 'production' })).toThrow(
      /VITE_API_URL is not set/,
    );
  });

  it('rejects a relative URL, which Axios would resolve against the site itself', () => {
    process.env.VITE_API_URL = '/api/v1';

    expect(() => buildConfig({ command: 'build', mode: 'production' })).toThrow(
      /not an absolute URL/,
    );
  });

  it('accepts the deployed URL and keeps the @ alias and env directory', () => {
    // `loadEnv` inside the config respects any existing process.env value over
    // files, so unset it for this case so `.env.production` is what the build sees.
    delete process.env.VITE_API_URL;
    const config = buildConfig({ command: 'build', mode: 'production' });

    const alias = (config.resolve?.alias ?? {}) as Record<string, string>;
    expect(alias['@']).toBe(path.join(WEB_ROOT, 'src'));
    expect(config.envDir).toBe(WEB_ROOT);
  });

  it('leaves the dev server alone, loopback URL and all', () => {
    process.env.VITE_API_URL = 'http://localhost:4000/api/v1';

    expect(() => buildConfig({ command: 'serve', mode: 'development' })).not.toThrow();
  });
});

describe('no page carries an API host of its own', () => {
  it('reads the base URL from the environment in exactly one place', () => {
    const client = readFileSync(path.join(WEB_ROOT, 'src/lib/api.ts'), 'utf8');

    expect(client).toContain('baseURL: import.meta.env.VITE_API_URL');
  });
});
