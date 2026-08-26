import express, { type RequestHandler } from 'express';

export const rawJsonBody: RequestHandler = express.raw({
  type: 'application/json',
  limit: '1mb',
});
