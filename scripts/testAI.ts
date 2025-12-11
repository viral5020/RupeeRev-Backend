import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db';
import { generateRecommendation } from '../src/services/investmentAI';
import { getLatestCategoryPerformance } from '../src/services/categoryPerformanceService';
import logger from '../src/utils/logger';

const run = async () => {
  await connectDB();
  const categoryPerformance = await getLatestCategoryPerformance();

  if (!categoryPerformance.length) {
    logger.warn('No category performance data found. Run the AMFI sync first.');
    return;
  }

  const scenarios = [
    { surplus: 3500, risk: 'low' as const },
    { surplus: 12000, risk: 'medium' as const },
    { surplus: 25000, risk: 'high' as const },
  ];

  for (const scenario of scenarios) {
    logger.info('----------------------------------------------');
    logger.info(`Scenario → Surplus: ₹${scenario.surplus}, Risk: ${scenario.risk}`);
    const recommendation = await generateRecommendation(
      scenario.surplus,
      scenario.risk,
      categoryPerformance
    );
    console.log(JSON.stringify(recommendation, null, 2));
  }
};

run()
  .catch((error) => {
    logger.error('AI test script failed', { error });
  })
  .finally(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });


