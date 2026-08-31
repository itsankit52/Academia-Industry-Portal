/**
 * Phase 15B — Training Content System
 *
 * Represents a module within a TrainingProgram. Modules organize lessons
 * into logical sections (e.g., "Week 1: Introduction", "Module 2: Core Concepts").
 * Each module has an order field for sequencing.
 */
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const trainingModuleSchema = new Schema(
  {
    training: {
      type: Schema.Types.ObjectId,
      ref: 'TrainingProgram',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    description: {
      type: String,
      maxlength: 2000,
      default: '',
    },
    order: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
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

// Ensure unique order within a training
trainingModuleSchema.index({ training: 1, order: 1 }, { unique: true });

export type TrainingModuleDoc = HydratedDocument<InferSchemaType<typeof trainingModuleSchema>>;
export const TrainingModule = model('TrainingModule', trainingModuleSchema);
