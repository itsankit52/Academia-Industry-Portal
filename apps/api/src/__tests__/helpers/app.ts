import type { Express } from 'express';
import { createApp } from '../../app';

export const TEST_MONGO_URI = process.env.TEST_MONGO_URI;
export const hasTestDb = Boolean(TEST_MONGO_URI);

let cached: Express | null = null;

export function createTestApp(): Express {
  if (!cached) cached = createApp();
  return cached;
}
