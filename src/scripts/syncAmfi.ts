import 'dotenv/config';
import { connectDB } from '../config/db';
import { syncAmfiData } from '../services/amfiService';
import logger from '../utils/logger';

const run = async () => {
  try {
    await connectDB();
    await syncAmfiData();
  } catch (error) {
    logger.error('Manual AMFI sync failed', { error });
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

run();


