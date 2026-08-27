import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/** Hosts that can only ever mean "the machine running the browser". */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1']);

/**
 * `import.meta.env.VITE_API_URL` is inlined by `vite build`, so whatever is set
 * while the bundle is produced is the address every visitor's browser calls —
 * correcting the variable afterwards needs a rebuild, not a restart. Both ways of
 * getting it wrong fail silently in the browser rather than at build time: with no
 * value the Axios `baseURL` is `undefined` and requests go to the site's own origin,
 * which serves `index.html` in place of JSON; with a loopback value they go to the
 * visitor's own machine. So refuse to produce such a bundle instead of publishing it.
 *
 * `.env.production` holds the deployed URL, but a real environment variable (a host's
 * dashboard, or an exported shell variable) overrides that file — hence the check runs
 * against the value Vite actually resolved.
 */
function assertDeployableApiUrl(apiUrl: string | undefined): void {
  const hint =
    'Set VITE_API_URL to the deployed API base URL, including the /api/v1 prefix (see apps/web/.env.production).';

  if (!apiUrl) {
    throw new Error(
      `VITE_API_URL is not set, so this bundle would ship without an API base URL. ${hint}`,
    );
  }

  let hostname: string;
  try {
    hostname = new URL(apiUrl).hostname;
  } catch {
    throw new Error(`VITE_API_URL is not an absolute URL: "${apiUrl}". ${hint}`);
  }

  if (LOOPBACK_HOSTS.has(hostname.toLowerCase())) {
    throw new Error(
      `VITE_API_URL is "${apiUrl}", which points at the machine running the browser rather than the deployed API. ${hint}`,
    );
  }
}

export default defineConfig(({ command, mode }) => {
  // Read the `.env` files from the same directory Vite will, so the check sees
  // exactly the value that is about to be inlined.
  const env = loadEnv(mode, __dirname, 'VITE_');

  if (command === 'build' && mode === 'production') {
    assertDeployableApiUrl(env.VITE_API_URL);
  }

  return {
    plugins: [react()],
    // Pinned so the files consulted above are the files the build itself reads,
    // whatever directory the build was invoked from.
    envDir: __dirname,
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
    },
  };
});
