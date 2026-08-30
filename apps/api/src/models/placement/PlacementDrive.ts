import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import {
  PLACEMENT_DRIVE_MODES,
  PLACEMENT_DRIVE_STATUSES,
  OPPORTUNITY_TYPES,
  VERIFICATION_STATUSES,
} from '@aip/config';

const driveOpportunitySchema = new Schema(
  {
    opportunityType: {
      type: String,
      required: true,
      enum: [...OPPORTUNITY_TYPES],
    },
    opportunityId: { type: Schema.Types.ObjectId, required: true },
    openings: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false },
);

const eligibilitySkillRequirementSchema = new Schema(
  {
    skillId: { type: Schema.Types.ObjectId, required: true },
    minProficiency: { type: String, required: true },
  },
  { _id: false },
);

const eligibilityRulesSchema = new Schema(
  {
    minCgpa: { type: Number, min: 0, max: 10 },
    allowedBranches: [{ type: String }],
    allowedGraduationYears: [{ type: Number }],
    maxActiveBacklogs: { type: Number, min: 0 },
    gender: { type: String },
    minReadinessScore: { type: Number, min: 0, max: 100 },
    blockIfAlreadyPlaced: { type: Boolean, default: false },
    maxOffersHeld: { type: Number, min: 0 },
    resumeRequired: { type: Boolean, default: false },
    minSkillProficiency: [eligibilitySkillRequirementSchema],
  },
  { _id: false },
);

const driveTimelineEntrySchema = new Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const verificationSubdocSchema = new Schema(
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

const placementDriveSchema = new Schema(
  {
    institution: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 5000,
    },
    mode: {
      type: String,
      required: true,
      enum: [...PLACEMENT_DRIVE_MODES],
      default: 'ONSITE',
    },
    location: { type: String, trim: true, maxlength: 200 },
    participatingCompanies: [
      { type: Schema.Types.ObjectId, ref: 'CompanyProfile', required: true },
    ],
    opportunities: { type: [driveOpportunitySchema], default: [] },
    eligibilityRules: { type: eligibilityRulesSchema, default: () => ({}) },
    registrationOpensAt: { type: Date },
    registrationClosesAt: { type: Date },
    driveStartsAt: { type: Date },
    driveEndsAt: { type: Date },
    status: {
      type: String,
      required: true,
      enum: [...PLACEMENT_DRIVE_STATUSES],
      default: 'DRAFT',
      index: true,
    },
    maxParticipationsPerStudent: { type: Number, default: 1, min: 1, max: 5 },
    totalSlots: { type: Number, min: 0 },
    filledSlots: { type: Number, default: 0, min: 0 },
    coordinators: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({ timeline: [] }),
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
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

// Compound indexes
placementDriveSchema.index({ institution: 1, status: 1, driveStartsAt: -1 });
placementDriveSchema.index({ status: 1, registrationClosesAt: 1 });
placementDriveSchema.index(
  { title: 'text', description: 'text', location: 'text' },
);

export type PlacementDriveDoc = HydratedDocument<InferSchemaType<typeof placementDriveSchema>>;
export const PlacementDrive = model('PlacementDrive', placementDriveSchema);
