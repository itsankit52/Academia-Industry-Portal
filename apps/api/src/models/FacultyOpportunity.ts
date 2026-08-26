import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { OPPORTUNITY_TYPES, WORK_MODES } from '@aip/config';

export const FACULTY_OPPORTUNITY_TYPES = OPPORTUNITY_TYPES.filter((t) =>
  ['FACULTY_INTERNSHIP', 'FDP', 'CONSULTANCY', 'COLLABORATIVE_RESEARCH', 'PROJECT', 'APPRENTICESHIP'].includes(t),
) as unknown as ReadonlyArray<
  'FACULTY_INTERNSHIP' | 'FDP' | 'CONSULTANCY' | 'COLLABORATIVE_RESEARCH' | 'PROJECT' | 'APPRENTICESHIP'
>;

export const FACULTY_OPP_HOST_TYPES = ['COMPANY', 'INSTITUTION'] as const;
export type FacultyOppHostType = typeof FACULTY_OPP_HOST_TYPES[number];

export const FACULTY_OPP_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'] as const;
export type FacultyOppStatus = typeof FACULTY_OPP_STATUSES[number];

export const FACULTY_OPP_TARGET_ROLES = ['STUDENT', 'FACULTY'] as const;
export type FacultyOppTargetRole = typeof FACULTY_OPP_TARGET_ROLES[number];

const stipendSchema = new Schema(
  {
    amount: { type: Number, min: 0 },
    currency: { type: String, default: 'INR', trim: true },
  },
  { _id: false },
);

const facultyOpportunitySchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200, index: true },
    description: { type: String, required: true, minlength: 20, maxlength: 10000 },
    opportunityType: {
      type: String,
      required: true,
      enum: [...FACULTY_OPPORTUNITY_TYPES],
    },
    hostType: {
      type: String,
      required: true,
      enum: [...FACULTY_OPP_HOST_TYPES],
      index: true,
    },
    host: { type: Schema.Types.ObjectId, required: true, refPath: 'hostType' },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requiredExpertise: {
      type: [String],
      default: [],
      set: (arr: string[]) => (arr ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean),
    },
    preferredQualifications: {
      type: [String],
      default: [],
      set: (arr: string[]) => (arr ?? []).map((s) => s.trim()).filter(Boolean),
    },
    durationWeeks: { type: Number, min: 1, max: 260 },
    stipend: { type: stipendSchema, default: undefined },
    location: { type: String, required: true, trim: true },
    mode: { type: String, required: true, enum: [...WORK_MODES] },
    applicationDeadline: { type: Date, required: true },
    openings: { type: Number, min: 1, default: 1 },
    targetRoles: {
      type: [String],
      enum: [...FACULTY_OPP_TARGET_ROLES],
      required: true,
      validate: {
        validator: (arr: string[]) => Array.isArray(arr) && arr.length > 0,
        message: 'targetRoles must include at least one role',
      },
    },
    status: {
      type: String,
      enum: [...FACULTY_OPP_STATUSES],
      default: 'DRAFT',
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

facultyOpportunitySchema.index({ title: 'text', description: 'text' });
facultyOpportunitySchema.index({ status: 1, createdAt: -1 });

export type FacultyOpportunityDoc = HydratedDocument<InferSchemaType<typeof facultyOpportunitySchema>>;
export const FacultyOpportunity = model('FacultyOpportunity', facultyOpportunitySchema);
