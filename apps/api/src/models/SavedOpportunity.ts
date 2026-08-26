import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { OPPORTUNITY_TYPES } from '@aip/config';

const savedOpportunitySchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true,
    },
    opportunityType: { type: String, required: true, enum: [...OPPORTUNITY_TYPES] },
    opportunity: { type: Schema.Types.ObjectId, required: true },
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

savedOpportunitySchema.index(
  { student: 1, opportunityType: 1, opportunity: 1 },
  { unique: true },
);

export type SavedOpportunityDoc = HydratedDocument<InferSchemaType<typeof savedOpportunitySchema>>;
export const SavedOpportunity = model('SavedOpportunity', savedOpportunitySchema);
