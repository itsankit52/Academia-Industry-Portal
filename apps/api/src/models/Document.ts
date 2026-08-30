import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { DOCUMENT_TYPES, VERIFICATION_STATUSES } from '@aip/config';

const documentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    documentType: {
      type: String,
      required: true,
      enum: [...DOCUMENT_TYPES],
      index: true,
    },
    filename: { type: String, required: true, trim: true, minlength: 1, maxlength: 255 },
    data: { type: Buffer, required: true, select: false },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    title: { type: String, trim: true, maxlength: 200 },
    issuer: { type: String, trim: true, maxlength: 200 },
    issuedDate: { type: Date },
    verificationStatus: {
      type: String,
      required: true,
      enum: [...VERIFICATION_STATUSES],
      default: 'PENDING',
      index: true,
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    verificationNotes: { type: String, trim: true, maxlength: 1000 },
    // Phase 6B — link a document (e.g. an offer letter) back to the application it
    // was attached to, so a company can attach an offer letter to a specific
    // application without giving the student access to the company's other
    // documents. Optional — documents without this field behave as before.
    application: { type: Schema.Types.ObjectId, ref: 'Application', index: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.data;
        return ret;
      },
    },
  },
);

documentSchema.index({ user: 1, documentType: 1 });
documentSchema.index({ verificationStatus: 1, createdAt: -1 });

export type DocumentDoc = HydratedDocument<InferSchemaType<typeof documentSchema>>;
export const DocumentModel = model('Document', documentSchema);
