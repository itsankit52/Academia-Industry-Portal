import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { EMPLOYMENT_TYPES, JOB_STATUSES, WORK_MODES } from '@aip/config';

const salarySchema = new Schema(
  {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 },
    currency: { type: String, default: 'INR', trim: true },
  },
  { _id: false },
);

const jobSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: 'CompanyProfile',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200, index: true },
    description: { type: String, required: true, minlength: 20, maxlength: 10000 },
    location: { type: String, required: true, trim: true },
    workMode: { type: String, required: true, enum: [...WORK_MODES] },
    employmentType: { type: String, required: true, enum: [...EMPLOYMENT_TYPES] },
    salary: { type: salarySchema, default: undefined },
    experienceMin: { type: Number, min: 0 },
    experienceMax: { type: Number, min: 0 },
    minCgpa: { type: Number, min: 0, max: 10 },
    eligibleBranches: [{ type: String, trim: true }],
    eligibleGradYears: [{ type: Number, min: 1970, max: 2100 }],
    requiredSkills: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
    preferredSkills: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
    applicationDeadline: { type: Date },
    openings: { type: Number, min: 1, default: 1 },
    status: { type: String, enum: [...JOB_STATUSES], default: 'DRAFT', index: true },
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

jobSchema.index({ title: 'text', description: 'text', location: 'text' });
jobSchema.index({ status: 1, createdAt: -1 });

export type JobDoc = HydratedDocument<InferSchemaType<typeof jobSchema>>;
export const Job = model('Job', jobSchema);
