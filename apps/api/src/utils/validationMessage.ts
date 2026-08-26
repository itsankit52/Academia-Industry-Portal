import type { ApiErrorDetail } from '@aip/types';

const SUMMARY_LIMIT = 3;

/**
 * Builds the `message` for a validation failure so it names the offending fields.
 * Clients that only surface `error.message` (toasts, logs) then get something
 * actionable instead of a bare "Validation failed"; the full list still travels
 * in `error.details`.
 */
export function describeValidationFailure(details: ApiErrorDetail[], scope?: string): string {
  const prefix = `Validation failed${scope ? ` in request ${scope}` : ''}`;
  if (details.length === 0) return prefix;

  const shown = details
    .slice(0, SUMMARY_LIMIT)
    .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
    .join('; ');
  const hidden = details.length - Math.min(details.length, SUMMARY_LIMIT);

  return `${prefix}: ${shown}${hidden > 0 ? ` (and ${hidden} more)` : ''}`;
}
