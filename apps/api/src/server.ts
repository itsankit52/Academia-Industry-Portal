import { createApp } from './app';
import { connectDB } from './db/mongoose';
import { logger } from './utils/logger';
import { env } from './config/env';
import { processExpiredOffers } from './modules/applications/offerExpiry.service';

const OFFER_EXPIRY_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function main(): Promise<void> {
  await connectDB();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening');
  });

  // Run offer expiry processor on startup and periodically
  let offerExpiryTimer: NodeJS.Timeout | null = null;
  const startOfferExpiryScheduler = (): void => {
    // Run immediately on startup (don't await — fire-and-forget so we don't
    // block server boot if the DB is slow)
    void processExpiredOffers().catch((err) => {
      logger.error({ err, action: 'processExpiredOffers' }, 'Initial offer expiry run failed');
    });
    offerExpiryTimer = setInterval(() => {
      void processExpiredOffers().catch((err) => {
        logger.error({ err, action: 'processExpiredOffers' }, 'Scheduled offer expiry run failed');
      });
    }, OFFER_EXPIRY_INTERVAL_MS);
    logger.info({ intervalMs: OFFER_EXPIRY_INTERVAL_MS }, 'Offer expiry scheduler started');
  };

  startOfferExpiryScheduler();

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      logger.info(`${sig} received, shutting down`);
      if (offerExpiryTimer) {
        clearInterval(offerExpiryTimer);
        offerExpiryTimer = null;
      }
      server.close(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
});
