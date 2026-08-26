import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const companyProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    companyName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
      index: true,
    },
    description: { type: String, maxlength: 5000 },
    industry: { type: String, trim: true },
    website: { type: String, trim: true },
    phone: { type: String, trim: true },
    location: { type: String, trim: true },
    companySize: { type: String, trim: true },
    foundedYear: { type: Number, min: 1800, max: 2100 },
    logoUrl: { type: String, trim: true },
    verifiedAt: { type: Date },
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

export type CompanyProfileDoc = HydratedDocument<InferSchemaType<typeof companyProfileSchema>>;
export const CompanyProfile = model('CompanyProfile', companyProfileSchema);
