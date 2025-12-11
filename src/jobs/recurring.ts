import cron from 'node-cron';
import dayjs from 'dayjs';
import Transaction from '../models/transaction';
import { createNotification } from '../services/notificationService';

const frequencyToIncrement: Record<string, dayjs.ManipulateType> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

export const startRecurringJob = () => {
  cron.schedule('0 * * * *', async () => {
    const now = new Date();
    const dueTransactions = await Transaction.find({ isRecurring: true, 'recurrence.nextRun': { $lte: now } });
    for (const template of dueTransactions) {
      const clone = template.toObject();
      Reflect.deleteProperty(clone, '_id');
      clone.isRecurring = false;
      clone.attachments = [];
      await Transaction.create(clone);
      const increment = frequencyToIncrement[template.recurrence?.frequency || 'monthly'];
      if (template.recurrence) {
        template.recurrence.nextRun = dayjs(template.recurrence.nextRun).add(1, increment).toDate();
        if (template.recurrence.remainingOccurrences) {
          template.recurrence.remainingOccurrences -= 1;
          if (template.recurrence.remainingOccurrences <= 0) {
            template.isRecurring = false;
          }
        }
        if (template.recurrence.endDate && dayjs(template.recurrence.endDate).isBefore(new Date())) {
          template.isRecurring = false;
        }
      }
      await template.save();
      await createNotification(template.user.toString(), {
        type: 'recurring',
        title: 'Recurring transaction logged',
        message: `${template.title} added automatically`,
      });
    }
  });
};

