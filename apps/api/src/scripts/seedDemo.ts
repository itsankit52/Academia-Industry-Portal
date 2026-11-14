/**
 * Demo data seeder — `pnpm seed:demo` (root) or `pnpm --filter @aip/api seed:demo`.
 *
 * Adds interconnected demo institutions, companies, faculty, students, jobs,
 * internships, applications, interviews and placement drives so every role's
 * dashboard has data. Unlike `seed.ts` it never deletes anything: each record is
 * found by a natural key and only created when missing, so re-running it is a
 * no-op. All demo accounts use the reserved `@demo.acadin.test` domain.
 *
 *   --env-file=<path>          load this env file first (overrides the cwd .env)
 *   --apply                    write; without it the run is a read-only dry run
 *   --confirm-target=<id>      must equal the printed target id, e.g. "localhost/acadin_demo"
 *
 * Remote or NODE_ENV=production targets additionally require the target id to be
 * listed in DEMO_SEED_APPROVED_TARGETS in the (untracked) env file.
 */
import { config as loadEnv } from 'dotenv';
import mongoose from 'mongoose';

const USAGE =
  'Usage: seed:demo [--env-file=<path>] [--apply --confirm-target=<hosts/db>] [--dry-run]';

async function main(): Promise<number> {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const known = ['--env-file=', '--apply', '--dry-run', '--confirm-target=', '--help'];
  const unknown = args.filter(
    (a) => !known.some((k) => (k.endsWith('=') ? a.startsWith(k) : a === k)),
  );
  if (unknown.length || args.includes('--help')) {
    if (unknown.length) console.error(`Unknown argument(s): ${unknown.join(' ')}`);
    console.info(USAGE);
    return unknown.length ? 1 : 0;
  }
  const value = (name: string) =>
    args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
  const apply = args.includes('--apply');
  if (apply && args.includes('--dry-run')) {
    console.error('--apply and --dry-run are mutually exclusive');
    return 1;
  }

  const envFile = value('--env-file');
  if (envFile) {
    const loaded = loadEnv({ path: envFile, override: true });
    if (loaded.error) {
      console.error(`Could not read env file ${envFile}`);
      return 1;
    }
    console.info(`Env file : ${envFile}`);
  }

  // A dry run must not write anything at all — including the collections and
  // indexes Mongoose creates on connect. This has to be set before any model is
  // compiled, i.e. before the dynamic import below.
  if (!apply) {
    mongoose.set('autoIndex', false);
    mongoose.set('autoCreate', false);
  }

  // Imported only now so config/env.ts validates the env we just loaded.
  const { runDemoSeed } = await import('./demo/run');
  return runDemoSeed({ apply, confirmTarget: value('--confirm-target') });
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error('Demo seed failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
