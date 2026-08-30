import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import {
  APPLICATION_STATUSES,
  OPPORTUNITY_TYPES,
  RECRUITMENT_SOURCES,
  VERIFICATION_STATUSES,
} from '@aip/config';

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
    // Internship lifecycle date fields (used when opportunityType is INTERNSHIP)
    selectedAt: { type: Date },
    startDate: { type: Date },
    expectedEndDate: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    // Phase 5B — mentor assignment for active internships
    mentor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    mentorAssignedAt: { type: Date },
    // Phase 6A — student offer response (used for JOB placements and optionally INTERNSHIPs)
    offerRespondedAt: { type: Date },
    // Phase 6B — offer details (salary, joining date, terms) and expiry.
    // Stored on the application rather than the Job so each candidate can receive
    // a candidate-specific package. The Job's salary remains the public posting.
    offerDetails: {
      offeredSalary: { type: Number, min: 0 },
      currency: { type: String, trim: true, maxlength: 8 },
      joiningDate: { type: Date },
      offerTerms: { type: String, maxlength: 5000 },
      updatedAt: { type: Date },
    },
    offerExpiresAt: { type: Date, index: true },
    // Phase 6B — offer letter (Document of type OFFER_LETTER linked to this application)
    offerLetter: { type: Schema.Types.ObjectId, ref: 'Document' },
    // Phase 6B — student-initiated withdrawal after OFFER_ACCEPTED
    withdrawalRequestedAt: { type: Date },
    withdrawalReason: { type: String, maxlength: 1000 },
    // Phase 7B — recruitment source. Owned by the company; set/updated on the
    // application so each candidate's source is recorded independently of the
    // posting. Optional for backward compatibility with pre-Phase 7B records.
    recruitmentSource: {
      type: String,
      enum: [...RECRUITMENT_SOURCES],
    },
    recruitmentSourceUpdatedAt: { type: Date },
    // Phase 7B — company-confirmed placement completion (for JOB applications).
    // Distinct from OFFER_ACCEPTED: that is the student accepting the offer;
    // placedAt records when the candidate actually joined / started the role.
    placedAt: { type: Date },
    placementCompletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    placementCompletionNotes: { type: String, maxlength: 2000 },
    // Phase 7B — institution/admin verification that the placement is genuine.
    // Stored as a subdocument so the verifying user and the verification status
    // evolve together; the absence of a subdoc implies "not yet verified".
    placementVerification: {
      status: { type: String, enum: [...VERIFICATION_STATUSES], default: 'PENDING' },
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      verifiedAt: { type: Date },
      note: { type: String, maxlength: 2000 },
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
