/**
 * Connection-string inspection used by the seed script's safety guard.
 *
 * This lives apart from `seed.ts` because that module runs the seed as a side
 * effect of being imported, so it can never be pulled into a test. The guard is
 * the only thing standing between `pnpm seed` and a wiped production database,
 * which makes it exactly the part that needs coverage.
 */

/**
 * Hosts a database may sit on and still be wiped without explicit
 * confirmation, because an instance on one of them is by definition a
 * throwaway dev database. `mongo` / `mongodb` are the usual service names
 * inside a compose network.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', 'mongo', 'mongodb']);

function hostOf(entry: string): string {
  // `[::1]:27017` — strip the brackets and the port together, since splitting
  // an IPv6 literal on ':' would otherwise return an empty first segment.
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(entry);
  if (bracketed) return bracketed[1] ?? '';
  return entry.split(':')[0] ?? '';
}

/**
 * Pulls just the host list out of a connection string. Credentials are dropped
 * rather than parsed: a password cannot reach a log line this way, because the
 * split takes everything after the last '@'. A malformed URI can still put a
 * *username* in the returned list — `mongodb://u:pa/ss@host/db` has an unencoded
 * '/' in the password, so the authority ends early and yields `["u"]`. That is
 * accepted: the guard then sees a non-local host and refuses, which is the safe
 * direction. A URI may carry several comma-separated hosts, which is why this
 * does not go through `new URL()`.
 */
export function targetHosts(uri: string): string[] {
  const authority = uri.replace(/^mongodb(\+srv)?:\/\//i, '').split(/[/?]/)[0] ?? '';
  // A password is allowed to contain '@', so the split has to happen at the
  // last one rather than the first.
  const withoutCredentials = authority.includes('@')
    ? authority.slice(authority.lastIndexOf('@') + 1)
    : authority;
  return withoutCredentials
    .split(',')
    .map((entry) => hostOf(entry.trim()))
    .filter((host) => host.length > 0);
}

/**
 * True only when every host is local. An unparseable URI yields no hosts and is
 * therefore treated as non-local, so the guard fails closed.
 */
export function isLocalTarget(uri: string): boolean {
  const hosts = targetHosts(uri);
  return hosts.length > 0 && hosts.every((host) => LOCAL_HOSTS.has(host.toLowerCase()));
}
