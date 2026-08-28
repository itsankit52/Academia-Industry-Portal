import { useCallback, useEffect, useState } from 'react';

/**
 * Like `useState`, but mirrors the value to `localStorage` so a refresh (or a
 * later visit) restores it. Returns `[value, setValue]` exactly like
 * `useState`, so call sites can use the setter as a normal React state
 * setter.
 *
 * The hook is defensive about environments where `localStorage` is missing
 * or throws (private windows in some browsers, sandboxed previews): reads
 * fall back to the provided default and writes are silently dropped, so
 * the component still renders.
 *
 * `key` should be unique per piece of state — every consumer passes its own
 * key and they cannot collide.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore: storage may be full or disabled
    }
  }, [key, value]);

  const update = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => (typeof next === 'function' ? (next as (p: T) => T)(prev) : next));
  }, []);

  return [value, update];
}
