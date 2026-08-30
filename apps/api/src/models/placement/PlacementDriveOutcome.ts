import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { PLACEMENT_PARTICIPANT_OUTCOMES, VERIFICATION_STATUSES } from '@aip/config';

const salaryPackageSchema = new Schema(
  {
    amount: { type: Number, min: 0 },
    currency: { type: String, trim: true, maxlength: 8, default: 'INR' },
    ctcLpa: { type: Number, min: 0 },
  },
  { _id: false },
);

const outcomeVerificationSchema = new Schema(
  {
    status: {
      type: String,
      enum: [...VERIFICATION_STATUSES],
      default: 'PENDING',
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    note: { type: String, maxlength: 2000 },
  },
  { _id: false },
);

const placementDriveOutcomeSchema = new Schema(
  {
    drive: { type: Schema.Types.ObjectId, ref: 'PlacementDrive', required: true, index: true },
    participant: { type: Schema.Types.ObjectId, ref: 'PlacementParticipant', required: true, unique: true },
    application: { type: Schema.Types.ObjectId, ref: 'Application' },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: 'CompanyProfile', required: true, index: true },
    outcome: { type: String, required: true, enum: [...PLACEMENT_PARTICIPANT_OUTCOMES] },
    salaryPackage: { type: salaryPackageSchema },
    joiningDate: { type: Date },
    offerExpiresAt: { type: Date },
    offerLetterRef: { type: Schema.Types.ObjectId, ref: 'Document' },
    notes: { type: String, maxlength: 2000 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    recordedAt: { type: Date, default: Date.now },
    verification: { type: outcomeVerificationSchema, default: () => ({}) },
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

placementDriveOutcomeSchema.index({ drive: 1, outcome: 1 });
placementDriveOutcomeSchema.index({ student: 1, recordedAt: -1 });
placementDriveOutcomeSchema.index({ company: 1, recordedAt: -1 });

export type PlacementDriveOutcomeDoc = HydratedDocument<InferSchemaType<typeof placementDriveOutcomeSchema>>;
export const PlacementDriveOutcome = model('PlacementDriveOutcome', placementDriveOutcomeSchema);
