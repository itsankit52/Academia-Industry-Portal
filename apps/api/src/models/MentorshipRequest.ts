import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { MENTORSHIP_STATUSES } from '@aip/config';

export const MENTORSHIP_MENTEE_ROLES = ['STUDENT', 'FACULTY'] as const;
export type MentorshipMenteeRole = typeof MENTORSHIP_MENTEE_ROLES[number];

const mentorshipRequestSchema = new Schema(
  {
    mentee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    menteeRole: { type: String, enum: [...MENTORSHIP_MENTEE_ROLES], required: true },
    mentor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: [...MENTORSHIP_STATUSES],
      default: 'REQUESTED',
      required: true,
      index: true,
    },
    initialMessage: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
    goals: { type: String, trim: true, maxlength: 2000 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
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

mentorshipRequestSchema.index({ mentor: 1, status: 1 });
mentorshipRequestSchema.index({ mentee: 1, status: 1 });

export type MentorshipRequestDoc = HydratedDocument<InferSchemaType<typeof mentorshipRequestSchema>>;
export const MentorshipRequest = model('MentorshipRequest', mentorshipRequestSchema);
