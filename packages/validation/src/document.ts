import { z } from 'zod';
import { DOCUMENT_TYPES, VERIFICATION_STATUSES } from '@aip/config';
import type { DocumentType, VerificationStatus } from '@aip/config';
import { objectIdSchema, paginationQuerySchema } from './common';

const documentTypeEnum = z.enum(DOCUMENT_TYPES as unknown as [DocumentType, ...DocumentType[]]);
const verificationStatusEnum = z.enum(
  VERIFICATION_STATUSES as unknown as [VerificationStatus, ...VerificationStatus[]],
);
const decisionEnum = z.enum(['VERIFIED', 'REJECTED'] as const);

export const documentMetadataSchema = z
  .object({
    documentType: documentTypeEnum,
    title: z.string().trim().min(1).max(200).optional(),
    issuer: z.string().trim().min(1).max(200).optional(),
    issuedDate: z.string().datetime().optional(),
  })
  .strict();

export const verifyDocumentSchema = z
  .object({
    verificationStatus: decisionEnum,
    verificationNotes: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine(
    (v) => v.verificationStatus !== 'REJECTED' || (v.verificationNotes && v.verificationNotes.length > 0),
    { message: 'verificationNotes is required when rejecting a document', path: ['verificationNotes'] },
  );

export const listDocumentsQuerySchema = paginationQuerySchema.extend({
  documentType: documentTypeEnum.optional(),
  verificationStatus: verificationStatusEnum.optional(),
});

export const listVerificationQueueQuerySchema = paginationQuerySchema.extend({
  documentType: documentTypeEnum.optional(),
  userId: objectIdSchema.optional(),
  since: z.string().datetime().optional(),
});

export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>;
export type VerifyDocumentInput = z.infer<typeof verifyDocumentSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
export type ListVerificationQueueQuery = z.infer<typeof listVerificationQueueQuerySchema>;
