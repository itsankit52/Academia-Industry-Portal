import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { PLACEMENT_PARTICIPANT_STATUSES, OPPORTUNITY_TYPES } from '@aip/config';

const participantOpportunitySchema = new Schema(
  {
    opportunityType: { type: String, required: true, enum: [...OPPORTUNITY_TYPES] },
    opportunityId: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const participantTimelineEntrySchema = new Schema(
  {
    status: { type: String, required: true, enum: [...PLACEMENT_PARTICIPANT_STATUSES] },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, maxlength: 2000 },
  },
  { _id: false },
);

const placementParticipantSchema = new Schema(
  {
    drive: {
      type: Schema.Types.ObjectId,
      ref: 'PlacementDrive',
      required: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    studentProfile: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
    },
    company: {
      type: Schema.Types.ObjectId,
      ref: 'CompanyProfile',
      required: true,
    },
    opportunity: { type: participantOpportunitySchema },
    registeredAt: { type: Date, default: Date.now },
    currentRound: { type: String, maxlength: 100 },
    lastActivityAt: { type: Date },
    status: {
      type: String,
      required: true,
      enum: [...PLACEMENT_PARTICIPANT_STATUSES],
      default: 'REGISTERED',
      index: true,
    },
    application: { type: Schema.Types.ObjectId, ref: 'Application' },
    interviews: [{ type: Schema.Types.ObjectId, ref: 'Interview' }],
    timeline: { type: [participantTimelineEntrySchema], default: [] },
    notes: { type: String, maxlength: 1000 },
    withdrawnAt: { type: Date },
    withdrawalReason: { type: String, maxlength: 500 },
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

// Indexes
placementParticipantSchema.index({ drive: 1, student: 1, company: 1 }, { unique: true });
placementParticipantSchema.index({ drive: 1, status: 1 });
placementParticipantSchema.index({ student: 1, status: 1 });
placementParticipantSchema.index({ drive: 1, company: 1 });

export type PlacementParticipantDoc = HydratedDocument<InferSchemaType<typeof placementParticipantSchema>>;
export const PlacementParticipant = model('PlacementParticipant', placementParticipantSchema);
