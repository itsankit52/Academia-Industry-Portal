import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { APTITUDE_CATEGORIES } from '@aip/config';

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
const QUESTION_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

const aptitudeQuestionSchema = new Schema(
  {
    category: {
      type: String,
      required: true,
      enum: [...APTITUDE_CATEGORIES],
      index: true,
    },
    question: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
    options: {
      type: [{ type: String, trim: true }],
      required: true,
      validate: {
        validator(this: unknown, value: unknown): boolean {
          if (!Array.isArray(value) || value.length !== 4) return false;
          return value.every((v) => typeof v === 'string' && v.trim().length > 0);
        },
        message: 'options must contain exactly 4 non-empty strings',
      },
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3, select: false },
    explanation: { type: String, trim: true, maxlength: 2000 },
    difficulty: { type: String, enum: [...DIFFICULTIES], default: 'MEDIUM' },
    tags: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: [...QUESTION_STATUSES],
      default: 'ACTIVE',
      index: true,
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

aptitudeQuestionSchema.index({ category: 1, status: 1 });

export type AptitudeQuestionDoc = HydratedDocument<InferSchemaType<typeof aptitudeQuestionSchema>>;
export const AptitudeQuestion = model('AptitudeQuestion', aptitudeQuestionSchema);
