import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUserSettings {
  currency: string;
  timezone: string;
  notificationsEnabled: boolean;
}

export interface IUserDocument extends Document {
  name: string;
  email: string;
  password?: string;
  roles: string[];
  avatarUrl?: string;
  avatar?: string;
  provider: 'local' | 'google';
  googleId?: string;
  settings: IUserSettings;
  isPremium: boolean;
  premiumExpiresAt?: Date;
  tokenBalance: number;
  hasEverPurchasedTokens: boolean;
  subscriptionId?: string;
  monthlyPdfUploads: {
    count: number;
    lastReset: Date;
  };
  comparePassword(candidate: string): Promise<boolean>;
}

const SettingsSchema = new Schema<IUserSettings>(
  {
    currency: { type: String, default: 'USD' },
    timezone: { type: String, default: 'UTC' },
    notificationsEnabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const UserSchema = new Schema<IUserDocument>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: false },
    roles: { type: [String], default: ['user'] },
    avatarUrl: String,
    avatar: String,
    provider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String, sparse: true, unique: true },
    settings: { type: SettingsSchema, default: () => ({}) },
    isPremium: { type: Boolean, default: false },
    premiumExpiresAt: { type: Date },
    tokenBalance: { type: Number, default: 0 },
    hasEverPurchasedTokens: { type: Boolean, default: false },
    subscriptionId: { type: String },
    monthlyPdfUploads: {
      count: { type: Number, default: 0 },
      lastReset: { type: Date, default: Date.now }
    },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  return next();
});

UserSchema.methods.comparePassword = function comparePassword(candidate: string) {
  if (!this.password) {
    return Promise.resolve(false);
  }
  return bcrypt.compare(candidate, this.password);
};

export const User = model<IUserDocument>('User', UserSchema);
export default User;

