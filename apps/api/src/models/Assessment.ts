import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ASSESSMENT_STATUSES } from '@aip/config';

const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true, trim: true },
    targetSkills: [{ type: String, trim: true }],
    expectedConcepts: [{ type: String, trim: true }],
    maxMarks: { type: Number, required: true, min: 1, default: 10 },
  },
  { _id: false },
);

const answerSchema = new Schema(
  {
    questionId: { type: String, required: true },
    text: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const evaluationPerQuestionSchema = new Schema(
  {
    questionId: { type: String, required: true },
    score: { type: Number, required: true, min: 0 },
    feedback: { type: String, default: '' },
  },
  { _id: false },
);

const evaluationSchema = new Schema(
  {
    perQuestion: { type: [evaluationPerQuestionSchema], default: [] },
    totalScore: { type: Number, required: true, min: 0, max: 100 },
    rawScore: { type: Number, required: true, min: 0 },
    maxScore: { type: Number, required: true, min: 0 },
    overallFeedback: { type: String, default: '' },
    strengths: { type: String, default: '' },
    weaknesses: { type: String, default: '' },
    evaluatedAt: { type: Date, required: true },
  },
  { _id: false },
);

const assessmentSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [...ASSESSMENT_STATUSES],
      default: 'GENERATED',
      required: true,
      index: true,
    },
    skills: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
    skillNames: [{ type: String, trim: true }],
    questions: { type: [questionSchema], default: [] },
    answers: { type: [answerSchema], default: [] },
    evaluation: { type: evaluationSchema, default: undefined },
    durationMinutes: { type: Number, required: true, min: 1 },
    questionCount: { type: Number, required: true, min: 0 },
    startedAt: { type: Date, default: Date.now, required: true },
    expiresAt: { type: Date, required: true },
    submittedAt: { type: Date },
    generatedByModel: { type: String, required: true },
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

assessmentSchema.index({ student: 1, createdAt: -1 });

export type AssessmentDoc = HydratedDocument<InferSchemaType<typeof assessmentSchema>>;
export const Assessment = model('Assessment', assessmentSchema);
