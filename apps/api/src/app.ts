import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { globalLimiter } from './middleware/rateLimit';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import apiRouter from './routes';
import { rawJsonBody } from './middleware/rawBody';
import { csrfOriginGuard } from './middleware/csrf';

export function createApp(): Express {
  const app = express();

  // Exactly one trusted hop: Render's edge proxy, which appends the real client
  // address as the last X-Forwarded-For entry. `req.ip` is therefore the client
  // and a client-supplied X-Forwarded-For prefix is ignored. Never use `true`
  // here — that trusts the left-most (client-controlled) entry and would let
  // anyone pick their own rate-limit bucket.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(requestLogger);
  app.use(cookieParser());
  // Must run after cookieParser (it keys off the session cookies) and before
  // any route, so a cross-site cookie-bearing write is refused outright.
  app.use(csrfOriginGuard);
  app.use('/api/v1/webhooks', rawJsonBody);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use('/api/v1', globalLimiter);
  app.use('/api/v1', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
