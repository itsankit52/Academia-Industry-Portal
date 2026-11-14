/**
 * Write-safety decision for the demo seeder. Pure so it can be unit tested.
 *
 * Writing needs every one of these, otherwise the seeder stays read-only:
 *   1. `--apply` was passed (dry-run is the default).
 *   2. A database name is explicit (MONGODB_DB_NAME or the URI path), so the
 *      target cannot silently fall back to the driver's default `test` db.
 *   3. `--confirm-target=<id>` equals the resolved target id exactly.
 *   4. For any non-local host, or NODE_ENV=production: the same id is also
 *      listed in DEMO_SEED_APPROVED_TARGETS (comma-separated), which lives in
 *      the operator's untracked env file — a second, deliberate key.
 *
 * The target id is `<hosts>/<db>` and never contains credentials.
 */
import { isLocalTarget, targetHosts } from '../seedTarget';

export interface GuardInput {
  uri: string;
  dbNameEnv: string | undefined;
  nodeEnv: string;
  apply: boolean;
  confirmTarget: string | undefined;
  approvedTargets: string | undefined;
}

export interface GuardResult {
  targetId: string;
  dbName: string | undefined;
  local: boolean;
  mode: 'dry-run' | 'apply';
  /** Set when `apply` was requested but refused. */
  refusal?: string;
}

/** Database name from the path of a connection string, if any. */
export function dbNameFromUri(uri: string): string | undefined {
  const afterScheme = uri.replace(/^mongodb(\+srv)?:\/\//i, '');
  const slash = afterScheme.indexOf('/');
  if (slash === -1) return undefined;
  const name = afterScheme.slice(slash + 1).split('?')[0] ?? '';
  return name.length > 0 ? decodeURIComponent(name) : undefined;
}

export function resolveTarget(uri: string, dbNameEnv: string | undefined) {
  const dbName = dbNameEnv && dbNameEnv.trim() ? dbNameEnv.trim() : dbNameFromUri(uri);
  const hosts = targetHosts(uri);
  const targetId = `${hosts.join(',') || '(unparseable-host)'}/${dbName ?? '(no-db-name)'}`;
  return { targetId, dbName, local: isLocalTarget(uri) };
}

export function assessTarget(input: GuardInput): GuardResult {
  const { targetId, dbName, local } = resolveTarget(input.uri, input.dbNameEnv);
  const base = { targetId, dbName, local };
  if (!input.apply) return { ...base, mode: 'dry-run' };

  const refuse = (refusal: string): GuardResult => ({ ...base, mode: 'dry-run', refusal });

  if (!dbName) {
    return refuse('No database name is set. Set MONGODB_DB_NAME so the target is unambiguous.');
  }
  if (input.confirmTarget !== targetId) {
    return refuse(
      `Writes need --confirm-target="${targetId}" (exactly). ` +
        `Got ${input.confirmTarget ? `"${input.confirmTarget}"` : 'nothing'}.`,
    );
  }
  const needsApproval = !local || input.nodeEnv === 'production';
  if (needsApproval) {
    const approved = (input.approvedTargets ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (!approved.includes(targetId)) {
      return refuse(
        `"${targetId}" is a remote or production database and is not listed in ` +
          'DEMO_SEED_APPROVED_TARGETS. Add it to your untracked env file only if this ' +
          'database is approved for demo data.',
      );
    }
  }
  return { ...base, mode: 'apply' };
}
