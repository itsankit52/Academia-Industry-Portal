import crypto from 'crypto';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { env } from '../../config/env';
import { AuditLog } from '../../models/AuditLog';
import { logger } from '../../utils/logger';
import * as service from './webhooks.service';

function getRawBody(req: Request): Buffer {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf-8');
  throw AppError.badRequest('Request body must be raw JSON');
}

function verifySignature(rawBody: Buffer, headerValue: string | undefined, secret: string): boolean {
  if (!headerValue) return false;
  const provided = headerValue.startsWith('sha256=') ? headerValue.slice(7) : headerValue;
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (provided.length !== computed.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(computed, 'hex'));
  } catch {
    return false;
  }
}

function requireSecret(secret: string, name: string): void {
  if (!secret) {
    throw AppError.serviceUnavailable(`${name} webhook not configured`);
  }
}

async function writeAudit(action: 'WEBHOOK_LMS_CERTIFICATE' | 'WEBHOOK_ERP_SYNC', req: Request): Promise<void> {
  try {
    await AuditLog.create({
      action,
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  } catch (err) {
    logger.warn({ err, action }, 'Failed to write webhook audit log');
  }
}

export const lmsCertificate = asyncHandler(async (req: Request, res: Response) => {
  requireSecret(env.WEBHOOK_LMS_SECRET, 'LMS');
  const rawBody = getRawBody(req);
  const signature = req.get('x-webhook-signature');
  if (!verifySignature(rawBody, signature, env.WEBHOOK_LMS_SECRET)) {
    throw AppError.unauthorized('Invalid webhook signature');
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    throw AppError.badRequest('Body is not valid JSON');
  }
  const payload = service.parseLmsCertificatePayload(parsedJson);
  const result = await service.handleLmsCertificate(payload);
  await writeAudit('WEBHOOK_LMS_CERTIFICATE', req);
  return ok(res, result);
});

export const erpStudents = asyncHandler(async (req: Request, res: Response) => {
  requireSecret(env.WEBHOOK_ERP_SECRET, 'ERP');
  const rawBody = getRawBody(req);
  const signature = req.get('x-webhook-signature');
  if (!verifySignature(rawBody, signature, env.WEBHOOK_ERP_SECRET)) {
    throw AppError.unauthorized('Invalid webhook signature');
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    throw AppError.badRequest('Body is not valid JSON');
  }
  const payload = service.parseErpStudentSyncPayload(parsedJson);
  const summary = await service.handleErpStudentSync(payload);
  await writeAudit('WEBHOOK_ERP_SYNC', req);
  return ok(res, summary);
});
