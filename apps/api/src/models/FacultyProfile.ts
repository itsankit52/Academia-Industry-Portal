import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { GENDERS } from '@aip/config';

const facultyProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    institution: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
      index: true,
    },
    fullName: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    designation: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    department: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    employeeCode: { type: String, trim: true },
    phone: { type: String, trim: true },
    dob: { type: Date },
    gender: { type: String, enum: [...GENDERS] },
    qualifications: { type: [String], default: [] },
    researchInterests: { type: [String], default: [] },
    bio: { type: String, maxlength: 2000 },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
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

export type FacultyProfileDoc = HydratedDocument<InferSchemaType<typeof facultyProfileSchema>>;
export const FacultyProfile = model('FacultyProfile', facultyProfileSchema);
