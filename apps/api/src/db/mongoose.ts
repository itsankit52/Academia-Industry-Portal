import dns from 'node:dns';

dns.setServers([
  '1.1.1.1',
  '8.8.8.8',
]);


import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../utils/logger';

mongoose.set('strictQuery', true);

let signalHandlersAttached = false;

function attachSignalHandlers(): void {
  if (signalHandlersAttached) return;
  signalHandlersAttached = true;
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      void (async () => {
        try {
          await disconnectDB();
          logger.info({ signal: sig }, 'Mongo connection closed on signal');
        } catch (err) {
          logger.error({ err, signal: sig }, 'Error closing Mongo connection');
        } finally {
          process.exit(0);
        }
      })();
    });
  }
}

export async function connectDB(): Promise<void> {
  const { connection } = mongoose;

  connection.on('connected', () => {
    logger.info({ host: connection.host, db: connection.name }, 'Mongo connected');
  });
  connection.on('error', (err) => {
    logger.error({ err }, 'Mongo connection error');
  });
  connection.on('disconnected', () => {
    logger.warn('Mongo disconnected');
  });

  await mongoose.connect(env.MONGODB_URI, {
    ...(env.MONGODB_DB_NAME ? { dbName: env.MONGODB_DB_NAME } : {}),
  });

  attachSignalHandlers();
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
