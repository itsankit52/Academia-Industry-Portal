import { Types } from 'mongoose';
import type { Role } from '@aip/config';
import type {
  DocumentMetadataInput,
  ListDocumentsQuery,
  ListVerificationQueueQuery,
  VerifyDocumentInput,
} from '@aip/validation';
import type { Paginated } from '@aip/types';
import {
  Application,
  DocumentModel,
  Internship,
  Job,
  StudentProfile,
  User,
  type DocumentDoc,
} from '../../models';
import { AppError } from '../../utils/AppError';
import { applyPagination, buildPaginated } from '../../utils/pagination';
import { createNotification } from '../notifications/notifications.service';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

type VerifierRole = Extract<Role, 'ADMIN' | 'COMPANY' | 'INSTITUTION'>;

export interface UploadDocumentFile {
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
}

export async function uploadDocument(
  userId: string,
  file: UploadDocumentFile,
  meta: DocumentMetadataInput,
): Promise<DocumentDoc> {
  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
    throw AppError.badRequest(`Unsupported file type: ${file.mimeType}`);
  }
  if (file.sizeBytes > MAX_SIZE_BYTES) {
    throw AppError.badRequest('File exceeds the 5MB size limit');
  }

  const safeName = file.originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'document';

  const doc = await DocumentModel.create({
    user: new Types.ObjectId(userId),
    documentType: meta.documentType,
    filename: safeName,
    data: file.buffer,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    ...(meta.title ? { title: meta.title } : {}),
    ...(meta.issuer ? { issuer: meta.issuer } : {}),
    ...(meta.issuedDate ? { issuedDate: new Date(meta.issuedDate) } : {}),
    verificationStatus: 'PENDING',
  });
  return doc;
}

export async function listMyDocuments(
  userId: string,
  filters: ListDocumentsQuery,
): Promise<Paginated<DocumentDoc>> {
  const pg = applyPagination(filters);
  const where: Record<string, unknown> = { user: new Types.ObjectId(userId) };
  if (filters.documentType) where.documentType = filters.documentType;
  if (filters.verificationStatus) where.verificationStatus = filters.verificationStatus;

  const [items, total] = await Promise.all([
    DocumentModel.find(where).sort(pg.sort).skip(pg.skip).limit(pg.limit).lean(),
    DocumentModel.countDocuments(where),
  ]);

  const mapped = items.map((it) => {
    const { _id, __v, data, ...rest } = it as Record<string, unknown> & { _id: unknown };
    void __v;
    void data;
    return { id: String(_id), ...rest } as unknown as DocumentDoc;
  });

  return buildPaginated(mapped, total, pg.page, pg.pageSize);
}

async function assertMetaAccess(
  doc: DocumentDoc,
  requesterUserId: string,
  requesterRole: Role,
): Promise<void> {
  const ownerId = String(doc.user);
  if (ownerId === requesterUserId) return;
  if (requesterRole === 'ADMIN') return;
  if (
    (requesterRole === 'COMPANY' || requesterRole === 'INSTITUTION') &&
    doc.verificationStatus === 'PENDING'
  ) {
    if (await verifierCanReview(requesterUserId, requesterRole, ownerId)) return;
  }
  throw AppError.forbidden('Not allowed to access this document');
}

async function verifierCanReview(
  verifierUserId: string,
  verifierRole: Extract<Role, 'COMPANY' | 'INSTITUTION'>,
  ownerUserId: string,
): Promise<boolean> {
  if (verifierRole === 'INSTITUTION') {
    const verifier = await User.findById(verifierUserId).select('institution');
    if (!verifier?.institution) return false;
    const owner = await StudentProfile.findOne({ user: new Types.ObjectId(ownerUserId) }).select(
      'institution',
    );
    return (
      Boolean(owner?.institution) && String(owner!.institution) === String(verifier.institution)
    );
  }
  return isApplicantOfCompanyUser(ownerUserId, verifierUserId);
}

async function isApplicantOfCompanyUser(
  studentUserId: string,
  companyUserId: string,
): Promise<boolean> {
  const [companyProfile, studentProfile] = await Promise.all([
    (await import('../../models')).CompanyProfile.findOne({
      user: new Types.ObjectId(companyUserId),
    }).select('_id'),
    StudentProfile.findOne({ user: new Types.ObjectId(studentUserId) }).select('_id'),
  ]);
  if (!companyProfile || !studentProfile) return false;

  const [jobIds, internshipIds] = await Promise.all([
    Job.find({ company: companyProfile._id }).select('_id').lean(),
    Internship.find({ company: companyProfile._id }).select('_id').lean(),
  ]);
  const opportunityIds = [...jobIds.map((j) => j._id), ...internshipIds.map((i) => i._id)];
  if (opportunityIds.length === 0) return false;

  const count = await Application.countDocuments({
    student: studentProfile._id,
    opportunity: { $in: opportunityIds },
  });
  return count > 0;
}

export async function getDocumentMeta(
  id: string,
  requesterUserId: string,
  requesterRole: Role,
): Promise<DocumentDoc> {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw AppError.notFound('Document not found');
  await assertMetaAccess(doc, requesterUserId, requesterRole);
  return doc;
}

export interface DocumentBinary {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  sizeBytes: number;
}

export async function getDocumentBinary(
  id: string,
  requesterUserId: string,
  requesterRole: Role,
): Promise<DocumentBinary> {
  const doc = await DocumentModel.findById(id).select('+data');
  if (!doc) throw AppError.notFound('Document not found');
  await assertMetaAccess(doc, requesterUserId, requesterRole);
  const data = (doc as unknown as { data?: Buffer }).data;
  if (!data || data.length === 0) throw AppError.notFound('Document data is missing');
  return {
    buffer: Buffer.from(data),
    mimeType: doc.mimeType as string,
    filename: doc.filename as string,
    sizeBytes: (doc.sizeBytes as number) ?? data.length,
  };
}

export async function deleteDocument(id: string, userId: string): Promise<void> {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw AppError.notFound('Document not found');
  if (String(doc.user) !== userId) throw AppError.forbidden('Not the owner');
  await doc.deleteOne();
}

export async function listVerificationQueue(
  requesterUserId: string,
  requesterRole: VerifierRole,
  filters: ListVerificationQueueQuery,
): Promise<Paginated<DocumentDoc>> {
  const pg = applyPagination(filters);
  const where: Record<string, unknown> = { verificationStatus: 'PENDING' };

  if (filters.documentType) where.documentType = filters.documentType;
  if (filters.userId) where.user = new Types.ObjectId(filters.userId);
  if (filters.since) where.createdAt = { $gte: new Date(filters.since) };

  if (requesterRole === 'INSTITUTION') {
    const verifier = await User.findById(requesterUserId).select('institution');
    if (!verifier?.institution) return buildPaginated([], 0, pg.page, pg.pageSize);
    const students = await StudentProfile.find({ institution: verifier.institution })
      .select('user')
      .lean();
    where.user = { $in: students.map((s) => s.user) };
  } else if (requesterRole === 'COMPANY') {
    const { CompanyProfile } = await import('../../models');
    const companyProfile = await CompanyProfile.findOne({
      user: new Types.ObjectId(requesterUserId),
    }).select('_id');
    if (!companyProfile) return buildPaginated([], 0, pg.page, pg.pageSize);

    const [jobIds, internshipIds] = await Promise.all([
      Job.find({ company: companyProfile._id }).select('_id').lean(),
      Internship.find({ company: companyProfile._id }).select('_id').lean(),
    ]);
    const opportunityIds = [...jobIds.map((j) => j._id), ...internshipIds.map((i) => i._id)];
    if (opportunityIds.length === 0) return buildPaginated([], 0, pg.page, pg.pageSize);

    const apps = await Application.find({ opportunity: { $in: opportunityIds } })
      .select('student')
      .lean();
    const studentIds = Array.from(new Set(apps.map((a) => String(a.student)))).map(
      (s) => new Types.ObjectId(s),
    );
    if (studentIds.length === 0) return buildPaginated([], 0, pg.page, pg.pageSize);

    const students = await StudentProfile.find({ _id: { $in: studentIds } })
      .select('user')
      .lean();
    where.user = { $in: students.map((s) => s.user) };
    where.documentType = filters.documentType ?? 'CERTIFICATE';
  }

  const [items, total] = await Promise.all([
    DocumentModel.find(where)
      .populate('user', 'email role')
      .sort(pg.sort)
      .skip(pg.skip)
      .limit(pg.limit)
      .lean(),
    DocumentModel.countDocuments(where),
  ]);

  const mapped = items.map((it) => {
    const { _id, __v, data, ...rest } = it as Record<string, unknown> & { _id: unknown };
    void __v;
    void data;
    return { id: String(_id), ...rest } as unknown as DocumentDoc;
  });

  return buildPaginated(mapped, total, pg.page, pg.pageSize);
}

export async function verifyDocument(
  id: string,
  verifierUserId: string,
  verifierRole: VerifierRole,
  input: VerifyDocumentInput,
): Promise<DocumentDoc> {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw AppError.notFound('Document not found');

  if (verifierRole !== 'ADMIN') {
    const canReview = await verifierCanReview(
      verifierUserId,
      verifierRole as Extract<Role, 'COMPANY' | 'INSTITUTION'>,
      String(doc.user),
    );
    if (!canReview) throw AppError.forbidden('Not allowed to verify this document');
  }

  const previousStatus = doc.verificationStatus;
  doc.verificationStatus = input.verificationStatus;
  doc.verifiedBy = new Types.ObjectId(verifierUserId);
  doc.verifiedAt = new Date();
  if (input.verificationNotes !== undefined) doc.verificationNotes = input.verificationNotes;
  await doc.save();

  // Phase 14A: notify the document owner when verification status changes so
  // they don't have to poll the verification queue to learn the outcome.
  // Only fire if the status actually changed to avoid duplicate noise when an
  // admin re-confirms an already-verified record.
  if (previousStatus !== input.verificationStatus) {
    const ownerId = String(doc.user);
    const docLabel = doc.title || doc.filename || 'document';
    if (input.verificationStatus === 'VERIFIED') {
      await createNotification(
        ownerId,
        'DOCUMENT_VERIFIED',
        'Document verified',
        `Your document "${docLabel}" was verified.`,
        // Link to the right place per role: students and faculty use the
        // documents surface; company users go to the verification queue.
        await buildDocumentLink(doc.user, verifierRole),
      );
    } else if (input.verificationStatus === 'REJECTED') {
      await createNotification(
        ownerId,
        'DOCUMENT_REJECTED',
        'Document rejected',
        `Your document "${docLabel}" was rejected${input.verificationNotes ? `: ${input.verificationNotes}` : '.'}`,
        await buildDocumentLink(doc.user, verifierRole),
      );
    }
  }

  return doc;
}

/**
 * Phase 14A: best-effort deep link for the notification body. We look at the
 * owner's role when possible so the student gets `/student/documents` and a
 * faculty owner gets `/faculty/settings` (or fallback to the documents page).
 */
async function buildDocumentLink(
  ownerUserId: Types.ObjectId | string,
  verifierRole: VerifierRole,
): Promise<string> {
  // Verifier-side deep link to the queue row so the verifier can audit who
  // they notified. We look up the owner role to pick the right student/faculty
  // surface.
  if (verifierRole !== 'ADMIN') {
    return verifierRole === 'COMPANY' ? '/company/verifications' : '/institution/verifications';
  }
  const owner = await User.findById(ownerUserId).select('role').lean();
  const role = (owner as { role?: string } | null)?.role;
  if (role === 'FACULTY') return '/faculty/settings';
  return '/student/documents';
}
