import { Types } from 'mongoose';

/**
 * Every schema in this project carries the same `toJSON` transform: rename `_id`
 * to `id` and drop `__v`. Mongoose only runs that transform on hydrated
 * documents, so a query that ends in `.lean()` hands the client raw `_id`
 * ObjectIds instead — and every client route builder, list `key` and detail link
 * is written against `id`.
 *
 * Services that read with `.lean()` for speed pass their rows through this
 * helper so the wire format matches the rest of the API. Populated references
 * are nested plain objects with their own `_id`, so the walk is recursive.
 */
function convert(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Types.ObjectId) return value.toHexString();
  // Dates and Buffers are objects but must survive intact — recursing into them
  // would flatten a Date into `{}`.
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map(convert);
  if (typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (key === '__v') continue;
    if (key === '_id') {
      out.id = convert(val);
      continue;
    }
    out[key] = convert(val);
  }
  return out;
}

/** Rewrites a `.lean()` row (or array of rows) into the API's public JSON shape. */
export function serializeLean<T>(row: T): T {
  return convert(row) as T;
}
