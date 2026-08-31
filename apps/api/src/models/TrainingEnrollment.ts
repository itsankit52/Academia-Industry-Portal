import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { TRAINING_ENROLLMENT_STATUSES } from '@aip/config';

const trainingEnrollmentSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true,
    },
    training: {
      type: Schema.Types.ObjectId,
      ref: 'TrainingProgram',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [...TRAINING_ENROLLMENT_STATUSES],
      default: 'ENROLLED',
      required: true,
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    certificateId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
    },
    // Phase 15B — Track completed lessons for granular progress
    completedLessons: {
      type: [{ type: Schema.Types.ObjectId, ref: 'TrainingLesson' }],
      default: [],
    },
    // Track current position for resume functionality
    currentLesson: {
      type: Schema.Types.ObjectId,
      ref: 'TrainingLesson',
      default: undefined,
    },
    // Total lessons in the training (for progress calculation)
    totalLessons: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Unique constraint: one enrollment per student per training
trainingEnrollmentSchema.index({ student: 1, training: 1 }, { unique: true });
trainingEnrollmentSchema.index({ training: 1, status: 1 });
trainingEnrollmentSchema.index({ student: 1, status: 1 });

export type TrainingEnrollmentDoc = HydratedDocument<
  InferSchemaType<typeof trainingEnrollmentSchema>
>;
export const TrainingEnrollment = model('TrainingEnrollment', trainingEnrollmentSchema);
