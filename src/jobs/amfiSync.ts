import cron from 'node-cron';
import { syncAmfiData } from '../services/amfiService';
import logger from '../utils/logger';

const SCHEDULE = '0 22 * * *'; // 10:00 PM daily

export const startAmfiSyncJob = () => {
  cron.schedule(
    SCHEDULE,
    async () => {
      try {
        await syncAmfiData();
      } catch (error) {
        logger.error('AMFI sync failed', { error });
      }
    },
    { timezone: 'Asia/Kolkata' }
  );
  logger.info('AMFI nightly sync scheduled for 10 PM IST.');
};


