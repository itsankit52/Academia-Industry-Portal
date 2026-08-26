import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const mentorshipMessageSchema = new Schema(
  {
    request: {
      type: Schema.Types.ObjectId,
      ref: 'MentorshipRequest',
      required: true,
      index: true,
    },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    readAt: { type: Date },
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

mentorshipMessageSchema.index({ request: 1, createdAt: 1 });

export type MentorshipMessageDoc = HydratedDocument<InferSchemaType<typeof mentorshipMessageSchema>>;
export const MentorshipMessage = model('MentorshipMessage', mentorshipMessageSchema);
