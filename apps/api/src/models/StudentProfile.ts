import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { GENDERS } from '@aip/config';

const projectSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
    techStack: [{ type: String, trim: true }],
    link: { type: String, trim: true },
  },
  { _id: false },
);

const certificationSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    issuer: { type: String, required: true, trim: true, maxlength: 200 },
    issuedAt: { type: Date },
    credentialUrl: { type: String, trim: true },
  },
  { _id: false },
);

const experienceSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    organization: { type: String, required: true, trim: true, maxlength: 200 },
    startDate: { type: Date },
    endDate: { type: Date },
    description: { type: String, maxlength: 2000 },
  },
  { _id: false },
);

const achievementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
    date: { type: Date },
  },
  { _id: false },
);

const studentProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    institution: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
      index: true,
    },
    fullName: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    phone: { type: String, trim: true },
    dob: { type: Date },
    gender: { type: String, enum: [...GENDERS] },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    address: { type: String, trim: true },
    college: { type: String, trim: true },
    university: { type: String, trim: true },
    degree: { type: String, trim: true },
    branch: { type: String, trim: true },
    semester: { type: Number, min: 1, max: 12 },
    graduationYear: { type: Number, min: 1970, max: 2100 },
    cgpa: { type: Number, min: 0, max: 10 },
    bio: { type: String, maxlength: 2000 },
    projects: { type: [projectSchema], default: [] },
    certifications: { type: [certificationSchema], default: [] },
    experience: { type: [experienceSchema], default: [] },
    achievements: { type: [achievementSchema], default: [] },
    preferredRoles: [{ type: String, trim: true }],
    preferredLocations: [{ type: String, trim: true }],
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

export type StudentProfileDoc = HydratedDocument<InferSchemaType<typeof studentProfileSchema>>;
export const StudentProfile = model('StudentProfile', studentProfileSchema);
