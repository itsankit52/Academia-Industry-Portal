import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import {
  PLACEMENT_ACTION_ITEM_TYPES,
  PLACEMENT_ACTION_ITEM_SEVERITY,
  PLACEMENT_ACTION_ITEM_STATUSES,
  ROLES,
} from '@aip/config';

const placementActionItemSchema = new Schema(
  {
    institution: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
      index: true,
    },
    drive: { type: Schema.Types.ObjectId, ref: 'PlacementDrive', index: true },
    participant: { type: Schema.Types.ObjectId, ref: 'PlacementParticipant' },
    student: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    type: { type: String, required: true, enum: [...PLACEMENT_ACTION_ITEM_TYPES] },
    severity: { type: String, required: true, enum: [...PLACEMENT_ACTION_ITEM_SEVERITY] },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    recommendedAction: { type: String, trim: true, maxlength: 500 },
    ctaPath: { type: String, trim: true, maxlength: 300 },
    ctaLabel: { type: String, trim: true, maxlength: 100 },
    status: {
      type: String,
      required: true,
      enum: [...PLACEMENT_ACTION_ITEM_STATUSES],
      default: 'OPEN',
      index: true,
    },
    assigneeRole: { type: String, enum: [...ROLES] },
    assignee: { type: Schema.Types.ObjectId, ref: 'User' },
    dueAt: { type: Date },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionNote: { type: String, maxlength: 500 },
    dedupeKey: { type: String, maxlength: 300 },
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

placementActionItemSchema.index({ institution: 1, status: 1, severity: 1, dueAt: 1 });
placementActionItemSchema.index({ student: 1, status: 1 });
placementActionItemSchema.index({ drive: 1, type: 1 });
placementActionItemSchema.index(
  { institution: 1, dedupeKey: 1 },
  { unique: true, sparse: true },
);

export type PlacementActionItemDoc = HydratedDocument<InferSchemaType<typeof placementActionItemSchema>>;
export const PlacementActionItem = model('PlacementActionItem', placementActionItemSchema);
