import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const studentProjectSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 5000,
    },
    /** Short text describing the student's role or contribution */
    role: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    /** Technology stack or skills used */
    technologies: {
      type: [String],
      default: [],
    },
    /** Links to GitHub, live demo, etc. */
    links: {
      type: [
        {
          label: { type: String, trim: true, maxlength: 100 },
          url: { type: String, trim: true, maxlength: 500 },
        },
      ],
      default: [],
    },
    /** ISO date string or Date when the project was completed */
    completedAt: {
      type: Date,
    },
    /** Whether this project is publicly visible on the portfolio */
    isPublic: {
      type: Boolean,
      default: true,
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

studentProjectSchema.index({ student: 1, createdAt: -1 });

export type StudentProjectDoc = HydratedDocument<InferSchemaType<typeof studentProjectSchema>>;
export const StudentProject = model('StudentProject', studentProjectSchema);
