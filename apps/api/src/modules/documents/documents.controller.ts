import type { Request, Response } from 'express';
import type { Role } from '@aip/config';
import type {
  DocumentMetadataInput,
  ListDocumentsQuery,
  ListVerificationQueueQuery,
  VerifyDocumentInput,
} from '@aip/validation';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, noContent, ok } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { AuditLog } from '../../models';
import * as service from './documents.service';

type VerifierRole = Extract<Role, 'ADMIN' | 'COMPANY' | 'INSTITUTION'>;

function requireUserId(req: Request): string {
  const id = req.user?.id;
  if (!id) throw AppError.unauthorized('Authentication required');
  return id;
}

export const uploadMine = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const file = req.file;
  if (!file) throw AppError.badRequest('Document file is required');

  const doc = await service.uploadDocument(
    userId,
    {
      buffer: file.buffer,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      originalName: file.originalname,
    },
    req.body as DocumentMetadataInput,
  );

  void AuditLog.create({
    actor: userId,
    role: req.user!.role,
    action: 'DOCUMENT_UPLOAD',
    entity: 'Document',
    entityId: String(doc._id),
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  });

  created(res, doc);
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await service.listMyDocuments(userId, req.query as unknown as ListDocumentsQuery);
  ok(res, result);
});

export const getMeta = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const doc = await service.getDocumentMeta(req.params.id!, userId, req.user!.role);
  ok(res, doc);
});

export const getBinary = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const bin = await service.getDocumentBinary(req.params.id!, userId, req.user!.role);
  res.setHeader('Content-Type', bin.mimeType);
  res.setHeader('Content-Length', String(bin.sizeBytes));
  res.setHeader('Content-Disposition', `inline; filename="${bin.filename}"`);
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.status(200).end(bin.buffer);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  await service.deleteDocument(req.params.id!, userId);
  void AuditLog.create({
    actor: userId,
    role: req.user!.role,
    action: 'DOCUMENT_DELETE',
    entity: 'Document',
    entityId: req.params.id!,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  });
  noContent(res);
});

export const verificationQueue = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await service.listVerificationQueue(
    userId,
    req.user!.role as VerifierRole,
    req.query as unknown as ListVerificationQueueQuery,
  );
  ok(res, result);
});

export const verify = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const body = req.body as VerifyDocumentInput;
  const doc = await service.verifyDocument(
    req.params.id!,
    userId,
    req.user!.role as VerifierRole,
    body,
  );
  void AuditLog.create({
    actor: userId,
    role: req.user!.role,
    action: body.verificationStatus === 'VERIFIED' ? 'DOCUMENT_VERIFY' : 'DOCUMENT_REJECT',
    entity: 'Document',
    entityId: String(doc._id),
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  });
  ok(res, doc);
});
