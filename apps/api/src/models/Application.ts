import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { APPLICATION_STATUSES, OPPORTUNITY_TYPES } from '@aip/config';

const timelineEntrySchema = new Schema(
  {
    status: { type: String, enum: [...APPLICATION_STATUSES], required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, maxlength: 2000 },
  },
  { _id: false },
);

const applicationSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      index: true,
    },
    faculty: {
      type: Schema.Types.ObjectId,
      ref: 'FacultyProfile',
      index: true,
    },
    opportunityType: { type: String, required: true, enum: [...OPPORTUNITY_TYPES] },
    opportunity: { type: Schema.Types.ObjectId, required: true },
    status: {
      type: String,
      required: true,
      enum: [...APPLICATION_STATUSES],
      default: 'APPLIED',
      index: true,
    },
    resume: { type: Schema.Types.ObjectId, ref: 'Resume' },
    coverLetter: { type: String, maxlength: 5000 },
    matchScore: { type: Number, min: 0, max: 100 },
    timeline: { type: [timelineEntrySchema], default: [] },
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

applicationSchema.index(
  { student: 1, opportunityType: 1, opportunity: 1 },
  { unique: true, partialFilterExpression: { student: { $type: 'objectId' } } },
);
applicationSchema.index(
  { faculty: 1, opportunityType: 1, opportunity: 1 },
  { unique: true, partialFilterExpression: { faculty: { $type: 'objectId' } } },
);
applicationSchema.index({ status: 1, createdAt: -1 });

export type ApplicationDoc = HydratedDocument<InferSchemaType<typeof applicationSchema>>;
export const Application = model('Application', applicationSchema);
