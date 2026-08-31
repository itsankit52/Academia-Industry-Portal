/**
 * Phase 15B — Training Content System
 *
 * Represents a lesson within a TrainingModule. Lessons can be of different types:
 *   - VIDEO: External video URL (YouTube, Vimeo, etc.)
 *   - ARTICLE: Text/HTML content
 *   - QUIZ: Assessment questions
 *   - RESOURCE: External resource (PDF, documentation, etc.)
 *
 * This is intentionally lightweight — we don't host video files.
 * External URLs are stored as resourceUrl.
 */
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const TRAINING_LESSON_TYPES = ['VIDEO', 'ARTICLE', 'QUIZ', 'RESOURCE'] as const;
export type TrainingLessonType = (typeof TRAINING_LESSON_TYPES)[number];

const trainingLessonSchema = new Schema(
  {
    module: {
      type: Schema.Types.ObjectId,
      ref: 'TrainingModule',
      required: true,
      index: true,
    },
    training: {
      type: Schema.Types.ObjectId,
      ref: 'TrainingProgram',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    description: {
      type: String,
      maxlength: 2000,
      default: '',
    },
    type: {
      type: String,
      required: true,
      enum: [...TRAINING_LESSON_TYPES],
      default: 'ARTICLE',
    },
    // Content for ARTICLE type, or external URL for VIDEO/RESOURCE
    content: {
      type: String,
      default: '',
    },
    // External URL for VIDEO and RESOURCE types
    resourceUrl: {
      type: String,
      trim: true,
      default: '',
    },
    // Estimated duration in minutes
    durationMinutes: {
      type: Number,
      min: 0,
      max: 1440,
      default: 0,
    },
    order: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    // Optional: quiz questions stored as JSON string for QUIZ type
    quizData: {
      type: String,
      default: undefined,
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

// Ensure unique order within a module
trainingLessonSchema.index({ module: 1, order: 1 }, { unique: true });
// Index for efficient querying by training
trainingLessonSchema.index({ training: 1, order: 1 });

export type TrainingLessonDoc = HydratedDocument<InferSchemaType<typeof trainingLessonSchema>>;
export const TrainingLesson = model('TrainingLesson', trainingLessonSchema);
