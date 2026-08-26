import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const TRAINING_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

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
    registrationUrl: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: [...TRAINING_STATUSES],
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

export type TrainingProgramDoc = HydratedDocument<InferSchemaType<typeof trainingProgramSchema>>;
export const TrainingProgram = model('TrainingProgram', trainingProgramSchema);
