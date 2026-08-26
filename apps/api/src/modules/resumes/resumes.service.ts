import { Readable } from 'node:stream';
import { Types } from 'mongoose';
import type { UploadApiResponse } from 'cloudinary';
import type { Paginated } from '@aip/types';
import { Resume, StudentProfile, type ResumeDoc } from '../../models';
import { cloudinary, isCloudinaryConfigured } from '../../config/cloudinary';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { applyPagination, buildPaginated } from '../../utils/pagination';

async function studentIdForUser(userId: string): Promise<Types.ObjectId> {
  const profile = await StudentProfile.findOne({ user: new Types.ObjectId(userId) }).select('_id');
  if (!profile) throw AppError.notFound('Student profile not found');
  return profile._id;
}

function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (err, result) => {
        if (err || !result) {
          reject(err ?? new Error('Upload failed'));
          return;
        }
        resolve(result);
      },
    );
    Readable.from(buffer).pipe(stream);
  });
}

export interface UploadResumeInput {
  userId: string;
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
}

export interface UploadResumeInputExtended extends UploadResumeInput {
  filename?: string;
}

export async function uploadResumeForStudent(input: UploadResumeInputExtended): Promise<ResumeDoc> {
  const studentId = await studentIdForUser(input.userId);
  const latest = await Resume.findOne({ student: studentId }).sort({ version: -1 }).select('version');
  const nextVersion = ((latest?.version as number | undefined) ?? 0) + 1;
  const safeName = (input.filename ?? 'resume.pdf').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);

  const useCloudinary = process.env.RESUME_STORAGE === 'CLOUDINARY' && isCloudinaryConfigured();

  if (useCloudinary) {
    try {
      const uploaded = await uploadBufferToCloudinary(
        input.buffer,
        `aip/resumes/${String(studentId)}`,
      );
      return await Resume.create({
        student: studentId,
        storageMode: 'CLOUDINARY',
        filename: safeName,
        cloudinaryPublicId: uploaded.public_id,
        url: uploaded.secure_url,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        parsedSkills: [],
        version: nextVersion,
      });
    } catch (err) {
      logger.warn({ err }, 'Cloudinary upload failed; falling back to database storage');
    }
  }

  return await Resume.create({
    student: studentId,
    storageMode: 'DATABASE',
    filename: safeName,
    data: input.buffer,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    parsedSkills: [],
    version: nextVersion,
  });
}

export interface ResumeBinary {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  sizeBytes: number;
  url?: string;
}

export async function getResumeBinary(userId: string): Promise<ResumeBinary> {
  const studentId = await studentIdForUser(userId);
  const doc = await Resume.findOne({ student: studentId }).sort({ version: -1 }).select('+data');
  if (!doc) throw AppError.notFound('No resume uploaded yet');

  if (doc.storageMode === 'CLOUDINARY' && doc.url) {
    return {
      buffer: Buffer.alloc(0),
      mimeType: (doc.mimeType as string) ?? 'application/pdf',
      filename: (doc.filename as string) ?? 'resume.pdf',
      sizeBytes: (doc.sizeBytes as number) ?? 0,
      url: doc.url as string,
    };
  }

  const data = (doc as unknown as { data?: Buffer }).data;
  if (!data || data.length === 0) throw AppError.notFound('Resume file data is missing');

  return {
    buffer: Buffer.from(data),
    mimeType: (doc.mimeType as string) ?? 'application/pdf',
    filename: (doc.filename as string) ?? 'resume.pdf',
    sizeBytes: (doc.sizeBytes as number) ?? data.length,
  };
}

export async function getLatestResume(userId: string): Promise<ResumeDoc> {
  const studentId = await studentIdForUser(userId);
  const doc = await Resume.findOne({ student: studentId }).sort({ version: -1 });
  if (!doc) throw AppError.notFound('No resume uploaded yet');
  return doc;
}

export interface ListResumeHistoryInput {
  userId: string;
  page?: number;
  pageSize?: number;
}

export async function listResumeHistory(
  input: ListResumeHistoryInput,
): Promise<Paginated<ResumeDoc>> {
  const studentId = await studentIdForUser(input.userId);
  const pg = applyPagination({ ...input, sortBy: 'version', sortDir: 'desc' });
  const filter = { student: studentId };

  const [items, total] = await Promise.all([
    Resume.find(filter).sort({ version: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    Resume.countDocuments(filter),
  ]);

  return buildPaginated(items as unknown as ResumeDoc[], total, pg.page, pg.pageSize);
}

export async function deleteResume(userId: string, resumeId: string): Promise<void> {
  const studentId = await studentIdForUser(userId);
  const doc = await Resume.findById(resumeId);
  if (!doc) throw AppError.notFound('Resume not found');
  if (String(doc.student) !== String(studentId)) throw AppError.forbidden('Not the owner');

  if (isCloudinaryConfigured() && doc.cloudinaryPublicId) {
    try {
      await cloudinary.uploader.destroy(doc.cloudinaryPublicId as string);
    } catch (err) {
      logger.warn({ err, publicId: doc.cloudinaryPublicId }, 'Cloudinary destroy failed');
    }
  }

  await doc.deleteOne();
}

export async function deleteCurrentResume(userId: string): Promise<void> {
  const studentId = await studentIdForUser(userId);
  const doc = await Resume.findOne({ student: studentId }).sort({ version: -1 });
  if (!doc) throw AppError.notFound('No resume uploaded yet');

  if (isCloudinaryConfigured() && doc.cloudinaryPublicId) {
    try {
      await cloudinary.uploader.destroy(doc.cloudinaryPublicId as string);
    } catch (err) {
      logger.warn({ err, publicId: doc.cloudinaryPublicId }, 'Cloudinary destroy failed');
    }
  }

  await doc.deleteOne();
}
