import http from 'http';
import app from './app';
import env from './config/env';
import { connectDB } from './config/db';
import { startRecurringJob } from './jobs/recurring';
import { startAmfiSyncJob } from './jobs/amfiSync';
import { startStockPriceUpdateJob } from './jobs/stockPriceUpdate';
import { seedInvestmentOptions } from './seed/investmentOptions.seed';
import { seedStockRecommendations } from './seed/stockRecommendations.seed';
import logger from './utils/logger';

const start = async () => {
  await connectDB();
  await seedInvestmentOptions();
  await seedStockRecommendations();
  const server = http.createServer(app);
  server.listen(env.port, () => logger.info(`🚀 Server running on port ${env.port}`));
  startRecurringJob();
  startAmfiSyncJob();
  startStockPriceUpdateJob();
};

start();

