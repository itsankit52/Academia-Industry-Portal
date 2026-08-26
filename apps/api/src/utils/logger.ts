import { pino, type Logger } from 'pino';
import { env } from '../config/env';

const isDev = env.NODE_ENV !== 'production';

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: undefined,
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});
