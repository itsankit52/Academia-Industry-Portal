import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const resumeSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true,
    },
    storageMode: {
      type: String,
      enum: ['DATABASE', 'CLOUDINARY'],
      required: true,
      default: 'DATABASE',
    },
    filename: { type: String, trim: true, default: 'resume.pdf' },
    data: { type: Buffer, select: false },
    cloudinaryPublicId: { type: String, unique: true, sparse: true },
    url: { type: String, trim: true },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    parsedSkills: [{ type: String, trim: true }],
    version: { type: Number, default: 1, min: 1 },
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

export type ResumeDoc = HydratedDocument<InferSchemaType<typeof resumeSchema>>;
export const Resume = model('Resume', resumeSchema);
