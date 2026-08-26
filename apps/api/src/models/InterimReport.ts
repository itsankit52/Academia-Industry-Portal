import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const interimReportSchema = new Schema(
  {
    application: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true,
    },
    weekNumber: { type: Number, required: true, min: 1, max: 52 },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    workDescription: { type: String, trim: true, maxlength: 5000 },
    learnings: { type: String, trim: true, maxlength: 3000 },
    challenges: { type: String, trim: true, maxlength: 3000 },
    hoursSpent: { type: Number, min: 0, max: 168 },
    submittedAt: { type: Date, default: Date.now },
    mentorFeedback: { type: String, trim: true, maxlength: 2000 },
    mentorRating: { type: Number, min: 1, max: 5 },
    mentorReviewedAt: { type: Date },
    mentorReviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
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

interimReportSchema.index({ application: 1, weekNumber: 1 }, { unique: true });
interimReportSchema.index({ student: 1, createdAt: -1 });

export type InterimReportDoc = HydratedDocument<InferSchemaType<typeof interimReportSchema>>;
export const InterimReport = model('InterimReport', interimReportSchema);
