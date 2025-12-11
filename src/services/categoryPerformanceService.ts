import CategoryPerformance from '../models/categoryPerformance';
import MutualFund from '../models/mutualFund';
import logger from '../utils/logger';

const categoryFriendlyNames: Record<string, string> = {
  index: 'Index',
  equity: 'Large Cap Equity',
  balanced: 'Hybrid / Balanced',
  gold: 'Gold',
  debt: 'Debt / Low Risk',
};

const fallbackAverages: Record<
  string,
  { avg1Month: number; avg3Month: number; avg1Year: number }
> = {
  index: { avg1Month: 1.2, avg3Month: 3.4, avg1Year: 12 },
  equity: { avg1Month: 1.8, avg3Month: 5.2, avg1Year: 15 },
  balanced: { avg1Month: 1.4, avg3Month: 3.8, avg1Year: 10 },
  gold: { avg1Month: 2.1, avg3Month: 6.3, avg1Year: 14 },
  debt: { avg1Month: 0.8, avg3Month: 2.1, avg1Year: 7 },
};

const fallbackCategories = Object.entries(categoryFriendlyNames).map(
  ([normalizedCategory, category]) => ({
    category,
    normalizedCategory,
    avg1Month: fallbackAverages[normalizedCategory].avg1Month,
    avg3Month: fallbackAverages[normalizedCategory].avg3Month,
    avg1Year: fallbackAverages[normalizedCategory].avg1Year,
    updatedAt: new Date(),
  })
);

export const calculateCategoryPerformance = async () => {
  logger.info('Calculating category performance…');
  const metrics = await MutualFund.aggregate([
    {
      $match: {
        normalizedCategory: { $exists: true },
      },
    },
    {
      $group: {
        _id: '$normalizedCategory',
        avg1Month: { $avg: '$oneMonthReturn' },
        avg3Month: { $avg: '$threeMonthReturn' },
        avg1Year: { $avg: '$oneYearReturn' },
      },
    },
  ]);

  for (const metric of metrics) {
    const category = metric._id as string;
    const label = categoryFriendlyNames[category] || category;
    logger.info(
      `${label}: 1M=${metric.avg1Month?.toFixed?.(2) ?? 'NA'}, 3M=${metric.avg3Month?.toFixed?.(2) ?? 'NA'}, 1Y=${metric.avg1Year?.toFixed?.(2) ?? 'NA'}`
    );
    await CategoryPerformance.findOneAndUpdate(
      { normalizedCategory: category },
      {
        category: label,
        normalizedCategory: category,
        avg1Month: Number(metric.avg1Month?.toFixed?.(2) ?? 0),
        avg3Month: Number(metric.avg3Month?.toFixed?.(2) ?? 0),
        avg1Year: Number(metric.avg1Year?.toFixed?.(2) ?? 0),
      },
      { upsert: true, new: true }
    );
  }

  logger.info('Category performance updated.');
};

export const getLatestCategoryPerformance = async () => {
  const items = await CategoryPerformance.find().sort({ avg1Year: -1 }).lean();
  if (!items.length) {
    logger.warn('Category performance collection empty, returning fallback categories.');
    return fallbackCategories;
  }
  return items;
};


