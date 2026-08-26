import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { SKILL_CATEGORIES } from '@aip/config';

const SKILL_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

const skillSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    category: { type: String, required: true, enum: [...SKILL_CATEGORIES] },
    description: { type: String, maxlength: 500 },
    status: { type: String, enum: [...SKILL_STATUSES], default: 'ACTIVE' },
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

skillSchema.index({ name: 'text' });

export type SkillDoc = HydratedDocument<InferSchemaType<typeof skillSchema>>;
export const Skill = model('Skill', skillSchema);
