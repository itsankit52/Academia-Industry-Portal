import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const MENTOR_AVAILABILITIES = ['AVAILABLE', 'BUSY', 'UNAVAILABLE'] as const;
export type MentorAvailability = typeof MENTOR_AVAILABILITIES[number];

const mentorProfileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    bio: { type: String, maxlength: 5000 },
    expertise: {
      type: [String],
      default: [],
      set: (arr: string[]) => (arr ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean),
      index: true,
    },
    yearsExperience: { type: Number, min: 0, max: 60 },
    mentorshipCapacity: { type: Number, default: 3, min: 0, max: 50 },
    availability: {
      type: String,
      enum: [...MENTOR_AVAILABILITIES],
      default: 'AVAILABLE',
      index: true,
    },
    linkedInUrl: { type: String, trim: true },
    githubUrl: { type: String, trim: true },
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

export type MentorProfileDoc = HydratedDocument<InferSchemaType<typeof mentorProfileSchema>>;
export const MentorProfile = model('MentorProfile', mentorProfileSchema);
