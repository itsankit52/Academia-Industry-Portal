import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { INSTITUTION_VERIFICATION_STATUSES } from '@aip/config';

const institutionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 20,
      unique: true,
      index: true,
    },
    domain: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    city: { type: String, required: true, trim: true, maxlength: 120 },
    state: { type: String, required: true, trim: true, maxlength: 120 },
    contactEmail: { type: String, required: true, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    website: { type: String, trim: true },
    verificationStatus: {
      type: String,
      required: true,
      enum: [...INSTITUTION_VERIFICATION_STATUSES],
      default: 'PENDING',
      index: true,
    },
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

institutionSchema.index({ name: 'text' });

export type InstitutionDoc = HydratedDocument<InferSchemaType<typeof institutionSchema>>;
export const Institution = model('Institution', institutionSchema);
