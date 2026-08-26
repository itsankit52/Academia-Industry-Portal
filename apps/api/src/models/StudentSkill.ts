import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { PROFICIENCY_LEVELS } from '@aip/config';

const studentSkillSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true,
    },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, index: true },
    proficiency: { type: String, required: true, enum: [...PROFICIENCY_LEVELS] },
    yearsExperience: { type: Number, min: 0, max: 50 },
    evidenceUrl: { type: String, trim: true },
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

studentSkillSchema.index({ student: 1, skill: 1 }, { unique: true });

export type StudentSkillDoc = HydratedDocument<InferSchemaType<typeof studentSkillSchema>>;
export const StudentSkill = model('StudentSkill', studentSkillSchema);
