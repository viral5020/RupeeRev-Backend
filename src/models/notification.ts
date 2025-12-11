import { Schema, model, Document, Types } from 'mongoose';

export type NotificationType = 'budget' | 'recurring' | 'summary';

export interface INotificationDocument extends Document {
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  scheduledFor?: Date;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['budget', 'recurring', 'summary'], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    scheduledFor: Date,
  },
  { timestamps: true }
);

export const Notification = model<INotificationDocument>('Notification', NotificationSchema);
export default Notification;

