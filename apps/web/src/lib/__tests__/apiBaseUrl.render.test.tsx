/**
 * @vitest-environment node
 *
 * Tests that the production bundle would send requests to the deployed API,
 * not the machine running the browser. We avoid jsdom here because the
 * esbuild/vite import chain hits the TextEncoder invariant that jsdom gets
 * wrong; the same code paths are covered under jsdom by the other suites,
 * so this file only checks what URL `loadEnv` would inline.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { describe, it, expect } from 'vitest';

/** `apps/web`, found relative to this file so the cwd of the runner is irrelevant. */
const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Delete any existing process.env value so loadEnv reads fresh from the files. */
const resolveApiUrl = (mode: string): string | undefined => {
  delete process.env.VITE_API_URL;
  return loadEnv(mode, WEB_ROOT, 'VITE_').VITE_API_URL;
};

describe('the requests the deployed bundle would make', () => {
  it('uses the production API URL (not localhost) for jobs and internships', () => {
    const productionUrl = resolveApiUrl('production');

    expect(productionUrl).toBeDefined();
    expect(productionUrl).not.toContain('localhost');
    expect(productionUrl).toContain('/api/v1');
  });

  it('still uses the local API URL during development', () => {
    const developmentUrl = resolveApiUrl('development');

    expect(developmentUrl).toBeDefined();
    expect(developmentUrl).toContain('localhost');
    expect(developmentUrl).toContain('/api/v1');
  });
});

describe('no page carries an API host of its own', () => {
  it('has no hardcoded API host anywhere in the app sources', () => {
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

    const offenders = sourceFiles(path.join(WEB_ROOT, 'src')).filter((file) =>
      /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(readFileSync(file, 'utf8')),
    );

    expect(offenders.map((file) => path.relative(WEB_ROOT, file))).toEqual([]);
  });
});
