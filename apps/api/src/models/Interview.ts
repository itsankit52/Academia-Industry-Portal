import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { INTERVIEW_MODES, INTERVIEW_STATUSES } from '@aip/config';

const interviewSchema = new Schema(
  {
    application: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    mode: { type: String, required: true, enum: [...INTERVIEW_MODES] },
    scheduledAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, min: 15, max: 480, default: 60 },
    meetingLink: { type: String, trim: true },
    location: { type: String, trim: true },
    interviewer: { type: String, trim: true },
    notes: { type: String, maxlength: 5000 },
    feedback: { type: String, maxlength: 5000 },
    status: {
      type: String,
      required: true,
      enum: [...INTERVIEW_STATUSES],
      default: 'SCHEDULED',
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

export type InterviewDoc = HydratedDocument<InferSchemaType<typeof interviewSchema>>;
export const Interview = model('Interview', interviewSchema);
