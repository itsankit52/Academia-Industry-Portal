import pinoHttp from 'pino-http';
import { logger, serializeError } from '../utils/logger';

/**
 * The default request serializer records the full URL plus `query` and
 * `params` values. Query strings carry user input (search terms, e-mails,
 * institution codes), so only the path and the query *keys* are logged.
 * Headers stay (cookie/authorization are redacted by the base logger).
 */
export function serializeRequest(req: {
  id?: unknown;
  method?: unknown;
  url?: unknown;
  query?: unknown;
  headers?: unknown;
  remoteAddress?: unknown;
}) {
  return {
    id: req.id,
    method: req.method,
    url: String(req.url ?? '').split('?')[0],
    queryKeys: req.query && typeof req.query === 'object' ? Object.keys(req.query) : [],
    headers: req.headers,
    remoteAddress: req.remoteAddress,
  };
}

export const requestLogger = pinoHttp({
  logger,
  serializers: { req: serializeRequest, err: serializeError },
  autoLogging: {
    ignore: (req) => req.url === '/api/v1/health' || req.url === '/health',
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
