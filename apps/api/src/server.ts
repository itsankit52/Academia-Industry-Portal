import { createApp } from './app';
import { connectDB } from './db/mongoose';
import { logger } from './utils/logger';
import { env } from './config/env';

async function main(): Promise<void> {
  await connectDB();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening');
  });

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      logger.info(`${sig} received, shutting down`);
      server.close(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
});
