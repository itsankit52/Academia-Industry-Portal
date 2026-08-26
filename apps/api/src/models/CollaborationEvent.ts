import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { COLLAB_EVENT_TYPES, ROLES } from '@aip/config';

export const COLLAB_EVENT_HOST_TYPES = ['COMPANY', 'INSTITUTION'] as const;
export type CollabEventHostType = typeof COLLAB_EVENT_HOST_TYPES[number];

export const COLLAB_EVENT_MODES = ['ONLINE', 'ONSITE', 'HYBRID'] as const;
export type CollabEventMode = typeof COLLAB_EVENT_MODES[number];

export const COLLAB_EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'] as const;
export type CollabEventStatus = typeof COLLAB_EVENT_STATUSES[number];

const collaborationEventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200, index: true },
    description: { type: String, required: true, trim: true, minlength: 20, maxlength: 10000 },
    eventType: { type: String, required: true, enum: [...COLLAB_EVENT_TYPES], index: true },
    hostType: { type: String, required: true, enum: [...COLLAB_EVENT_HOST_TYPES], index: true },
    host: { type: Schema.Types.ObjectId, required: true, refPath: 'hostType' },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date },
    location: { type: String, trim: true },
    mode: { type: String, required: true, enum: [...COLLAB_EVENT_MODES] },
    meetingLink: { type: String, trim: true },
    capacity: { type: Number, min: 1 },
    registeredCount: { type: Number, default: 0, min: 0 },
    registrationDeadline: { type: Date },
    targetAudience: {
      type: [String],
      enum: [...ROLES],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
      set: (arr: string[]) => (arr ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean),
    },
    status: {
      type: String,
      enum: [...COLLAB_EVENT_STATUSES],
      default: 'DRAFT',
      required: true,
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

collaborationEventSchema.index({ title: 'text', description: 'text' });
collaborationEventSchema.index({ status: 1, startAt: 1 });

export type CollaborationEventDoc = HydratedDocument<InferSchemaType<typeof collaborationEventSchema>>;
export const CollaborationEvent = model('CollaborationEvent', collaborationEventSchema);
