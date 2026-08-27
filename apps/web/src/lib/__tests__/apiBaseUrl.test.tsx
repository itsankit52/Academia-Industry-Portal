import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import { loadEnv, type ConfigEnv, type UserConfig } from 'vite';
import { waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useJobs } from '@/hooks/queries/useJobs';
import { useInternships } from '@/hooks/queries/useInternships';
import { renderWithProviders } from '@/test/renderWithProviders';
import webViteConfig from '../../../vite.config';

/**
 * Where the deployed bundle sends its requests.
 *
 * The symptom this covers: the site served from Render was calling
 * `http://localhost:4000/api/v1/jobs` — the visitor's own machine — because the
 * only file that carried an API base URL was the gitignored `.env`, so a
 * production build had none and `import.meta.env.VITE_API_URL` was inlined as
 * `undefined`. Nothing failed at build time and nothing failed on load; the
 * requests simply went somewhere useless.
 *
 * Two things are worth holding still, and both are checked against the real
 * resolution rather than against a copy of it: `vite build` must resolve a
 * deployable URL through Vite's own `loadEnv` (the same call the config makes),
 * and it must refuse to produce a bundle when that URL would be missing, relative
 * or loopback. The last group then walks the actual jobs and internships hooks and
 * hands their paths to a real Axios client to confirm what the browser would fetch.
 */
// The request never has to settle — the path the hook asked for is the whole point.
const hoisted = vi.hoisted(() => ({
  apiGet: vi.fn((_url: string) => new Promise<never>(() => {})),
}));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  apiGet: hoisted.apiGet,
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

/** What `vite build` will inline, read the way the config reads it. */
const resolveApiUrl = (mode: string): string | undefined =>
  loadEnv(mode, WEB_ROOT, 'VITE_').VITE_API_URL;

let savedApiUrl: string | undefined;

beforeEach(() => {
  savedApiUrl = process.env.VITE_API_URL;
});

afterEach(() => {
  // A real environment variable outranks the `.env` files, so the cases below set
  // one to stand in for a host's dashboard. Put it back either way.
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
    // The API mounts every route under this prefix, and the client sends bare
    // paths like `/jobs`, so the prefix has to be part of the base URL.
    expect(url.pathname).toBe('/api/v1');
  });

  it('still points local development at the local API', () => {
    // The production value must not have leaked into the dev experience.
    const apiUrl = resolveApiUrl('development');

    expect(apiUrl).toBeDefined();
    expect(LOOPBACK.has(new URL(apiUrl!).hostname)).toBe(true);
  });

  it('is committed, so a build does not depend on an untracked file', () => {
    // `.env` is gitignored; `.env.production` is the file a fresh clone builds from.
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
    const config = buildConfig({ command: 'build', mode: 'production' });

    const alias = (config.resolve?.alias ?? {}) as Record<string, string>;
    expect(alias['@']).toBe(path.join(WEB_ROOT, 'src'));
    // Pinned so the files the guard consulted are the files the build reads.
    expect(config.envDir).toBe(WEB_ROOT);
  });

  it('leaves the dev server alone, loopback URL and all', () => {
    process.env.VITE_API_URL = 'http://localhost:4000/api/v1';

    expect(() => buildConfig({ command: 'serve', mode: 'development' })).not.toThrow();
  });
});

describe('the requests the deployed bundle would make', () => {
  /** The paths the hooks build, captured from the shared client they call. */
  async function pathsFrom(ui: React.ReactElement): Promise<string[]> {
    hoisted.apiGet.mockClear();
    renderWithProviders(ui);
    await waitFor(() => expect(hoisted.apiGet).toHaveBeenCalled());
    return hoisted.apiGet.mock.calls.map((call) => String(call[0]));
  }

  function Jobs() {
    useJobs({});
    return null;
  }

  function Internships() {
    useInternships({});
    return null;
  }

  it('sends the jobs list to the deployed API', async () => {
    const [jobsPath] = await pathsFrom(<Jobs />);
    // Axios joins base URL and path itself, so let it do the joining here too.
    const client = axios.create({ baseURL: resolveApiUrl('production') });

    const requested = client.getUri({ url: jobsPath });

    expect(requested).toBe(`${resolveApiUrl('production')}${jobsPath}`);
    expect(new URL(requested).pathname).toBe('/api/v1/jobs');
    expect(requested).not.toContain('localhost');
  });

  it('sends the internships list to the same deployed API', async () => {
    const [internshipsPath] = await pathsFrom(<Internships />);
    const client = axios.create({ baseURL: resolveApiUrl('production') });

    const requested = client.getUri({ url: internshipsPath });

    expect(new URL(requested).pathname).toBe('/api/v1/internships');
    expect(new URL(requested).hostname).toBe(new URL(resolveApiUrl('production')!).hostname);
    expect(requested).not.toContain('localhost');
  });
});

describe('no page carries an API host of its own', () => {
  /** Every source file under `apps/web/src`, tests excluded. */
  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== '__tests__' && entry !== 'node_modules') sourceFiles(full, out);
      } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  it('reads the base URL from the environment in exactly one place', () => {
    const client = readFileSync(path.join(WEB_ROOT, 'src/lib/api.ts'), 'utf8');

    expect(client).toContain('baseURL: import.meta.env.VITE_API_URL');
  });

  it('has no hardcoded API host anywhere in the app sources', () => {
    // The regression was a request to `http://localhost:4000/api/v1/jobs`; a
    // literal host in any page or hook would bring it straight back.
    const offenders = sourceFiles(path.join(WEB_ROOT, 'src')).filter((file) =>
      /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(readFileSync(file, 'utf8')),
    );

    expect(offenders.map((file) => path.relative(WEB_ROOT, file))).toEqual([]);
  });
});
