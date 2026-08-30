/**
 * Phase 8 — Training Enrollment Service
 *
 * Manages the student training enrollment lifecycle:
 *   ENROLLED → IN_PROGRESS → COMPLETED
 *   (any state) → DROPPED
 *
 * Idempotency:
 *   - Enrollment creation uses a unique compound index (student, training).
 *   - Completion checks for existing certificate before creating a new one.
 *   - Progress update is a state transition only (no side effects).
 *
 * Certificate reuse:
 *   - Reuses the existing Document system with documentType='CERTIFICATE'.
 *   - Reuses the existing CERTIFICATE_AVAILABLE notification type.
 *   - The Document model already has unique-ish access controls.
 */
import { Types } from 'mongoose';
import type { TrainingEnrollmentStatus, NotificationType } from '@aip/config';
import { AppError } from '../../utils/AppError';
import {
  DocumentModel,
  StudentProfile,
  TrainingEnrollment,
  TrainingProgram,
  type TrainingEnrollmentDoc,
  type TrainingProgramDoc,
} from '../../models';
import { createNotification } from '../notifications/notifications.service';

function serializeEnrollment(doc: TrainingEnrollmentDoc) {
  const json = doc.toJSON() as Record<string, unknown>;
  return { ...json, id: String(doc._id) };
}

export interface EnrollStudentInput {
  studentId: string;
  trainingId: string;
}

export async function enrollStudentInTraining(
  userId: string,
  studentProfileId: string,
  trainingId: string,
): Promise<TrainingEnrollmentDoc> {
  // Validate training exists and is ACTIVE
  const training = await TrainingProgram.findById(trainingId);
  if (!training) throw AppError.notFound('Training program not found');
  if (training.status === 'ARCHIVED') {
    throw AppError.badRequest('Training is archived');
  }
  if (training.registrationDeadline && training.registrationDeadline < new Date()) {
    throw AppError.badRequest('Registration deadline has passed');
  }

  // Idempotency: if already enrolled, return the existing enrollment
  const existing = await TrainingEnrollment.findOne({
    student: new Types.ObjectId(studentProfileId),
    training: new Types.ObjectId(trainingId),
  });
  if (existing) {
    if (existing.status === 'DROPPED') {
      // Re-enrollment: revive it
      existing.status = 'ENROLLED' as TrainingEnrollmentStatus;
      existing.progress = 0;
      existing.enrolledAt = new Date();
      existing.startedAt = undefined;
      existing.completedAt = undefined;
      existing.certificateId = undefined;
      await existing.save();
      return existing;
    }
    return existing;
  }

  const doc = await TrainingEnrollment.create({
    student: new Types.ObjectId(studentProfileId),
    training: new Types.ObjectId(trainingId),
    status: 'ENROLLED' as TrainingEnrollmentStatus,
    progress: 0,
  });

  // Notify the student
  await createNotification(
    userId,
    'TRAINING_ENROLLED' as NotificationType,
    'Training enrolled',
    `You have been enrolled in "${training.title}".`,
    `/student/trainings/${String(doc._id)}`,
  );

  return doc;
}

export async function dropEnrollment(
  userId: string,
  studentProfileId: string,
  enrollmentId: string,
): Promise<TrainingEnrollmentDoc> {
  const enrollment = await TrainingEnrollment.findById(enrollmentId);
  if (!enrollment) throw AppError.notFound('Enrollment not found');
  if (String(enrollment.student) !== String(studentProfileId)) {
    throw AppError.forbidden('Not your enrollment');
  }
  if (enrollment.status === 'COMPLETED') {
    throw AppError.badRequest('Cannot drop a completed training');
  }
  if (enrollment.status === 'DROPPED') {
    return enrollment; // idempotent
  }
  enrollment.status = 'DROPPED' as TrainingEnrollmentStatus;
  await enrollment.save();
  void userId;
  return enrollment;
}

export async function updateTrainingProgress(
  userId: string,
  studentProfileId: string,
  enrollmentId: string,
  progress: number,
): Promise<TrainingEnrollmentDoc> {
  const enrollment = await TrainingEnrollment.findById(enrollmentId);
  if (!enrollment) throw AppError.notFound('Enrollment not found');
  if (String(enrollment.student) !== String(studentProfileId)) {
    throw AppError.forbidden('Not your enrollment');
  }
  if (enrollment.status === 'COMPLETED') {
    throw AppError.badRequest('Cannot update progress on a completed training');
  }
  if (enrollment.status === 'DROPPED') {
    throw AppError.badRequest('Cannot update progress on a dropped training');
  }
  enrollment.progress = progress;
  if (progress > 0 && enrollment.status === 'ENROLLED') {
    enrollment.status = 'IN_PROGRESS' as TrainingEnrollmentStatus;
    enrollment.startedAt = new Date();
  }
  await enrollment.save();
  void userId;
  return enrollment;
}

/**
 * Generate a small text-based certificate (HTML→text serialization).
 * Reuses the existing Document system with documentType='CERTIFICATE' so that
 * the same access-control and download paths serve both internship and
 * training certificates. The filename and title carry the type so they remain
 * distinguishable in the document list.
 */
function buildCertificateText(args: {
  studentName: string;
  trainingTitle: string;
  provider: string;
  completionDate: Date;
  certificateId: string;
}): { text: string; filename: string; mimeType: string } {
  const { studentName, trainingTitle, provider, completionDate, certificateId } = args;
  const dateStr = completionDate.toISOString().slice(0, 10);
  const text = `Certificate of Completion\n\nThis is to certify that\n${studentName}\nhas successfully completed the training program\n"${trainingTitle}"\nprovided by ${provider}\non ${dateStr}.\n\nReference: ${certificateId}\n`;
  const safeTitle = trainingTitle.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'training';
  return {
    text,
    filename: `training_certificate_${safeTitle}_${certificateId}.txt`,
    mimeType: 'text/plain',
  };
}

export async function completeTrainingEnrollment(
  userId: string,
  studentProfileId: string,
  enrollmentId: string,
): Promise<TrainingEnrollmentDoc> {
  const enrollment = await TrainingEnrollment.findById(enrollmentId);
  if (!enrollment) throw AppError.notFound('Enrollment not found');
  if (String(enrollment.student) !== String(studentProfileId)) {
    throw AppError.forbidden('Not your enrollment');
  }

  // Idempotency — already completed: return as-is.
  if (enrollment.status === 'COMPLETED') return enrollment;

  if (enrollment.status === 'DROPPED') {
    throw AppError.badRequest('Cannot complete a dropped training');
  }

  const training = (await TrainingProgram.findById(enrollment.training)) as TrainingProgramDoc | null;
  if (!training) throw AppError.notFound('Training not found');

  const student = await StudentProfile.findById(studentProfileId).select('fullName user');
  if (!student) throw AppError.notFound('Student profile not found');

  const completionDate = new Date();
  // Reference id used in both the document filename and the certificate text.
  // Embedding it in the text makes each certificate visually distinguishable.
  const certificateId = new Types.ObjectId().toString();

  // Build the certificate body (text — small, deterministic, and easy to download).
  const { text, filename, mimeType } = buildCertificateText({
    studentName: String(student.fullName ?? 'Student'),
    trainingTitle: String(training.title),
    provider: String(training.provider),
    completionDate,
    certificateId,
  });
  const buffer = Buffer.from(text, 'utf-8');

  // Reuse the Document system. We pass the student USER id because documents
  // are owned by the user, not the student profile.
  const doc = await DocumentModel.create({
    user: new Types.ObjectId(userId),
    documentType: 'CERTIFICATE',
    filename,
    data: buffer,
    mimeType,
    sizeBytes: buffer.length,
    title: `Training Certificate: ${training.title}`,
    issuer: String(training.provider),
    issuedDate: completionDate,
    verificationStatus: 'PENDING',
  });

  enrollment.status = 'COMPLETED' as TrainingEnrollmentStatus;
  enrollment.progress = 100;
  enrollment.completedAt = completionDate;
  enrollment.certificateId = doc._id as Types.ObjectId;
  await enrollment.save();

  // Notify the student about completion + certificate availability
  await createNotification(
    userId,
    'TRAINING_COMPLETED' as NotificationType,
    'Training completed',
    `You have completed "${training.title}". Your certificate is now available.`,
    `/student/trainings/${String(enrollment._id)}`,
  );
  await createNotification(
    userId,
    'TRAINING_CERTIFICATE_AVAILABLE' as NotificationType,
    'Certificate available',
    `Your training certificate for "${training.title}" is now available to download.`,
    `/student/trainings/${String(enrollment._id)}`,
  );

  return enrollment;
}

export async function getEnrollmentById(
  enrollmentId: string,
  requesterUserId: string,
  requesterRole: string,
): Promise<TrainingEnrollmentDoc> {
  const enrollment = await TrainingEnrollment.findById(enrollmentId)
    .populate({ path: 'training', select: 'title provider durationWeeks' })
    .populate({ path: 'student', select: 'user fullName' });
  if (!enrollment) throw AppError.notFound('Enrollment not found');

  // Resolve the student user id from the populated student
  const studentUserId = (enrollment.student as unknown as { user?: { _id?: unknown } })
    ?.user?._id;
  if (requesterRole !== 'ADMIN' && String(studentUserId) !== requesterUserId) {
    throw AppError.forbidden('Not your enrollment');
  }
  return enrollment;
}

export async function listMyEnrollments(
  userId: string,
  studentProfileId: string,
  filters: { page?: number; pageSize?: number; status?: TrainingEnrollmentStatus },
) {
  const where: Record<string, unknown> = { student: new Types.ObjectId(studentProfileId) };
  if (filters.status) where.status = filters.status;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    TrainingEnrollment.find(where)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate({ path: 'training', select: 'title provider durationWeeks skills' })
      .lean(),
    TrainingEnrollment.countDocuments(where),
  ]);
  void userId;
  return { items, total, page, pageSize };
}

export async function listTrainingEnrollmentsForCompany(
  trainingId: string,
  filters: { page?: number; pageSize?: number; status?: TrainingEnrollmentStatus },
) {
  const where: Record<string, unknown> = { training: new Types.ObjectId(trainingId) };
  if (filters.status) where.status = filters.status;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    TrainingEnrollment.find(where)
      .sort({ enrolledAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate({ path: 'student', select: 'fullName user' })
      .lean(),
    TrainingEnrollment.countDocuments(where),
  ]);
  return { items, total, page, pageSize };
}
