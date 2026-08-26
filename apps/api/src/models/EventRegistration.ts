import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const eventRegistrationSchema = new Schema(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: 'CollaborationEvent',
      required: true,
      index: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    registeredAt: { type: Date, default: Date.now },
    attendedAt: { type: Date },
    feedback: { type: String, trim: true, maxlength: 2000 },
    rating: { type: Number, min: 1, max: 5 },
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

eventRegistrationSchema.index({ event: 1, user: 1 }, { unique: true });

export type EventRegistrationDoc = HydratedDocument<InferSchemaType<typeof eventRegistrationSchema>>;
export const EventRegistration = model('EventRegistration', eventRegistrationSchema);
