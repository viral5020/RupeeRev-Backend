import { Schema, model, Document, Types } from 'mongoose';

export interface IRefreshTokenDocument extends Document {
  user: Types.ObjectId;
  token: string;
  expiresAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshTokenDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<IRefreshTokenDocument>('RefreshToken', RefreshTokenSchema);
export default RefreshToken;

