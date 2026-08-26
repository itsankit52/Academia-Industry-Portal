import { Router } from 'express';
import {
  documentMetadataSchema,
  idParamSchema,
  listDocumentsQuerySchema,
  listVerificationQueueQuerySchema,
  verifyDocumentSchema,
} from '@aip/validation';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { uploadDocument } from '../../middleware/upload';
import * as controller from './documents.controller';

const router = Router();

router.use(requireAuth);

router.get(
  '/verification-queue',
  requireRole('ADMIN', 'INSTITUTION', 'COMPANY'),
  validate(listVerificationQueueQuerySchema, 'query'),
  controller.verificationQueue,
);

router.post(
  '/me',
  requireRole('STUDENT', 'FACULTY'),
  uploadDocument.single('file'),
  validate(documentMetadataSchema),
  controller.uploadMine,
);

router.get(
  '/me',
  requireRole('STUDENT', 'FACULTY'),
  validate(listDocumentsQuerySchema, 'query'),
  controller.listMine,
);

router.get(
  '/:id/binary',
  validate(idParamSchema, 'params'),
  controller.getBinary,
);

router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  controller.getMeta,
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  controller.remove,
);

router.patch(
  '/:id/verify',
  requireRole('ADMIN', 'INSTITUTION', 'COMPANY'),
  validate(idParamSchema, 'params'),
  validate(verifyDocumentSchema),
  controller.verify,
);

export default router;
