import { Request, Response } from 'express';
import { listNotifications, markNotificationRead } from '../services/notificationService';
import { sendSuccess } from '../utils/apiResponse';

export const list = async (req: Request, res: Response) => {
  const notifications = await listNotifications(req.user!);
  return sendSuccess(res, notifications);
};

export const markRead = async (req: Request, res: Response) => {
  const notification = await markNotificationRead(req.user!, req.params.id);
  return sendSuccess(res, notification, 'Notification updated');
};

