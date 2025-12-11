import Notification from '../models/notification';
import { IUserDocument } from '../models/user';

export const createNotification = (userId: string, payload: { type: 'budget' | 'recurring' | 'summary'; title: string; message: string; scheduledFor?: Date }) =>
  Notification.create({ ...payload, user: userId });

export const listNotifications = (user: IUserDocument) => Notification.find({ user: user.id }).sort({ createdAt: -1 }).limit(50);

export const markNotificationRead = async (user: IUserDocument, id: string) => {
  const notification = await Notification.findOne({ _id: id, user: user.id });
  if (!notification) throw new Error('Notification not found');
  notification.read = true;
  await notification.save();
  return notification;
};

