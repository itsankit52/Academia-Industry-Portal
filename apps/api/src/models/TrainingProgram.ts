import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const TRAINING_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
const TRAINING_CONTENT_TYPES = ['INTERNAL', 'EXTERNAL', 'HYBRID'] as const;
const TRAINING_DIFFICULTY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;

const trainingProgramSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    description: { type: String, required: true, minlength: 20, maxlength: 10000 },
    provider: { type: String, required: true, trim: true },
    skills: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
    durationWeeks: { type: Number, required: true, min: 1, max: 104 },
    startDate: { type: Date },
    endDate: { type: Date },
    registrationDeadline: { type: Date },
    // Made optional: EXTERNAL training may not need in-platform registration
    registrationUrl: { type: String, trim: true },
    status: {
      type: String,
      enum: [...TRAINING_STATUSES],
      default: 'ACTIVE',
      index: true,
    },
    // Phase 15B — Extended training fields
    contentType: {
      type: String,
      enum: [...TRAINING_CONTENT_TYPES],
      default: 'INTERNAL',
    },
    difficulty: {
      type: String,
      enum: [...TRAINING_DIFFICULTY_LEVELS],
      default: 'INTERMEDIATE',
    },
    estimatedHours: { type: Number, min: 0, max: 10000 },
    certificateAvailable: { type: Boolean, default: false },
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

export type TrainingProgramDoc = HydratedDocument<InferSchemaType<typeof trainingProgramSchema>>;
export const TrainingProgram = model('TrainingProgram', trainingProgramSchema);
