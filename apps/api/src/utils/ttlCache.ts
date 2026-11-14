/**
 * Minimal in-process TTL cache for SHARED, non-user-specific data.
 *
 * - Per process: every API instance (and every restart) has its own copy; there
 *   is no cross-instance invalidation. With N instances a value can differ
 *   between instances for up to `ttlMs`.
 * - Staleness: a cached value is served for at most `ttlMs` after its load
 *   started; writes elsewhere are NOT pushed into the cache.
 * - Concurrent misses share one in-flight load (no stampede); a failed load is
 *   evicted immediately so the next caller retries.
 * - Values are deep-frozen before they are shared, so one request cannot
 *   mutate what another request reads.
 *
 * Never store user-specific data here — keys and values must be identical for
 * every caller.
 */

const registry = new Set<TtlCache<unknown>>();

/** Clears every TtlCache in this process (tests). */
export function clearAllTtlCaches(): void {
  for (const c of registry) c.clear();
}

/**
 * Recursively freezes plain objects and arrays. Class instances (ObjectId,
 * Date, Buffer, …) are left as-is: they are not reachable through property
 * assignment in our consumers and some (bson) keep lazy internal state.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  const proto = Object.getPrototypeOf(value);
  const plain = Array.isArray(value) || proto === Object.prototype || proto === null;
  if (!plain) return value;
  Object.freeze(value);
  for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  return value;
}

interface Entry<T> {
  value: Promise<T>;
  expiresAt: number;
}

export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(readonly ttlMs: number) {
    if (!(ttlMs > 0)) throw new Error('TtlCache: ttlMs must be > 0');
    registry.add(this as TtlCache<unknown>);
  }

  /** Returns the cached value for `key`, loading (and freezing) it on a miss or after expiry. */
  get(key: string, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > now) return hit.value;

    const value = load().then(deepFreeze);
    const entry: Entry<T> = { value, expiresAt: now + this.ttlMs };
    this.entries.set(key, entry);
    value.catch(() => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    });
    return value;
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
