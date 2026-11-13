import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ROLES } from '@aip/config';

const AUTH_PROVIDERS = ['local', 'google', 'both'] as const;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // passwordHash is now optional — Google-only accounts have no password.
    passwordHash: { type: String, select: false },
    role: { type: String, required: true, enum: [...ROLES] },
    isActive: { type: Boolean, default: true },
    refreshTokenVersion: { type: Number, default: 0, select: false },
    lastLoginAt: { type: Date },
    institution: { type: Schema.Types.ObjectId, ref: 'Institution', index: true },
    // Google OAuth fields — sparse index so only accounts that have a googleId
    // consume an entry and the unique constraint is not violated by the many
    // null values from local-only accounts.
    googleId: { type: String, sparse: true, unique: true, select: false },
    authProvider: { type: String, enum: [...AUTH_PROVIDERS], default: 'local' },
    // Profile picture sourced from Google on first sign-in; never overwritten
    // once a user has set their own avatar through the platform.
    googleAvatar: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.refreshTokenVersion;
        return ret;
      },
    },
  },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model('User', userSchema);
