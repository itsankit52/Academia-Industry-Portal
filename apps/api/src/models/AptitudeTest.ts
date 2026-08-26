import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { APTITUDE_CATEGORIES } from '@aip/config';

const APTITUDE_TEST_STATUSES = ['IN_PROGRESS', 'SUBMITTED', 'EXPIRED'] as const;

const testQuestionSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, ref: 'AptitudeQuestion', required: true },
    chosenIndex: { type: Number, default: null, min: 0, max: 3 },
    correct: { type: Boolean, default: null },
  },
  { _id: false },
);

const aptitudeTestSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: [...APTITUDE_CATEGORIES],
    },
    questions: { type: [testQuestionSchema], default: [] },
    totalQuestions: { type: Number, required: true, min: 1 },
    correctCount: { type: Number, default: 0, min: 0 },
    score: { type: Number, default: 0, min: 0, max: 100 },
    passingScore: { type: Number, default: 60, min: 0, max: 100 },
    passed: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [...APTITUDE_TEST_STATUSES],
      default: 'IN_PROGRESS',
      required: true,
      index: true,
    },
    startedAt: { type: Date, default: Date.now, required: true },
    expiresAt: { type: Date, required: true },
    submittedAt: { type: Date },
    durationSeconds: { type: Number, default: 1800, min: 60 },
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

aptitudeTestSchema.index({ user: 1, createdAt: -1 });

export type AptitudeTestDoc = HydratedDocument<InferSchemaType<typeof aptitudeTestSchema>>;
export const AptitudeTest = model('AptitudeTest', aptitudeTestSchema);
