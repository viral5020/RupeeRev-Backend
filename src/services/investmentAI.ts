import { HydratedDocument } from 'mongoose';
import { ICategoryPerformanceDocument } from '../models/categoryPerformance';
import { getLatestCategoryPerformance } from './categoryPerformanceService';
import logger from '../utils/logger';

const categoryLabels: Record<string, string> = {
  index: 'Large-Cap Index SIP',
  equity: 'Large-Cap Equity SIP',
  balanced: 'Balanced Hybrid SIP',
  gold: 'Gold SIP',
  debt: 'Low-Risk Debt SIP',
};

export interface AIRecommendation {
  bestPerformingCategory: string;
  allocation: Record<string, number>;
  reasoning: string;
  summary: string;
  planHorizonYears: number;
  totalInvested: number;
  projectedValue: number;
  actionChecklist: string[];
  allocationBreakdown: AllocationBreakdown[];
  categoryPerformance: Array<{
    category: string;
    normalizedCategory: string;
    avg1Month: number;
    avg3Month: number;
    avg1Year: number;
    updatedAt: Date;
  }>;
}

export interface AllocationBreakdown {
  category: string;
  label: string;
  percentage: number;
  monthlyAmount: number;
  annualizedReturn: number;
  fiveYearProjection: number;
  rationale: string;
}

const fallbackCategories = ['index', 'equity', 'balanced', 'gold', 'debt'] as const;

const buildFallbackPerformance = () =>
  fallbackCategories.map((key) => ({
    category: categoryLabels[key] || key,
    normalizedCategory: key,
    avg1Month: 0,
    avg3Month: 0,
    avg1Year: 0,
    updatedAt: new Date(),
  }));

const surplusTier = (surplus: number): 'low' | 'medium' | 'high' => {
  if (surplus < 5000) return 'low';
  if (surplus <= 15000) return 'medium';
  return 'high';
};

const horizonMap: Record<'low' | 'medium' | 'high', number> = {
  low: 3,
  medium: 5,
  high: 7,
};

const tiltRationale: Record<string, string> = {
  debt: 'Supports liquidity needs and protects capital during drawdowns.',
  index: 'Provides diversified market exposure with low cost.',
  gold: 'Acts as an inflation hedge and currency hedge for INR.',
  balanced: 'Combines equity upside with debt stability for smoother returns.',
  equity: 'Targets long-term wealth creation through higher growth.',
};

const baseAllocationMap: Record<'low' | 'medium' | 'high', Record<string, number>> = {
  low: { debt: 0.45, gold: 0.25, index: 0.3 },
  medium: { balanced: 0.4, index: 0.35, equity: 0.15, debt: 0.1 },
  high: { equity: 0.45, balanced: 0.3, index: 0.2, gold: 0.05 },
};

const applyRiskTilt = (
  allocation: Record<string, number>,
  riskLevel: 'low' | 'medium' | 'high'
) => {
  const updated = { ...allocation };
  const adjust = (key: string, delta: number) => {
    updated[key] = Math.max(0, (updated[key] || 0) + delta);
  };

  if (riskLevel === 'low') {
    adjust('debt', 0.1);
    adjust('index', 0.05);
    adjust('gold', 0.05);
    adjust('equity', -0.1);
  } else if (riskLevel === 'high') {
    adjust('equity', 0.15);
    adjust('balanced', -0.05);
    adjust('debt', -0.05);
    adjust('index', 0.05);
  }

  const total = Object.values(updated).reduce((sum, value) => sum + value, 0);
  if (total === 0) return allocation;
  Object.keys(updated).forEach((key) => {
    updated[key] = Number((updated[key] / total).toFixed(2));
  });
  return updated;
};

const calculatePlanProjection = (
  monthlyAmount: number,
  annualReturn: number,
  years: number
) => {
  const months = years * 12;
  const monthlyRate = annualReturn > 0 ? annualReturn / 100 / 12 : 0;
  if (monthlyRate === 0) {
    return monthlyAmount * months;
  }
  const futureValue =
    monthlyAmount * (((1 + monthlyRate) ** months - 1) / monthlyRate) * (1 + monthlyRate);
  return futureValue;
};

type CategoryPerformanceLike = Pick<
  ICategoryPerformanceDocument,
  'category' | 'normalizedCategory' | 'avg1Month' | 'avg3Month' | 'avg1Year' | 'updatedAt'
>;

export const generateRecommendation = async (
  userSurplus: number,
  riskLevel: 'low' | 'medium' | 'high',
  preloadedPerformance?: Array<HydratedDocument<ICategoryPerformanceDocument> | CategoryPerformanceLike>
): Promise<AIRecommendation> => {
  logger.info('Evaluating user profile…');
  logger.info(`User surplus: ${userSurplus}, Risk: ${riskLevel}`);

  const fetched = preloadedPerformance ?? (await getLatestCategoryPerformance());
  const performance = fetched.length ? fetched : buildFallbackPerformance();

  if (!fetched.length) {
    logger.warn('Category performance data missing, using fallback categories.');
  }

  const best = performance.reduce((acc, item) => {
    if (!acc) return item;
    return (item.avg1Year || 0) > (acc.avg1Year || 0) ? item : acc;
  }, performance[0]);

  const tier = surplusTier(userSurplus);
  const allocation = applyRiskTilt(baseAllocationMap[tier], riskLevel);
  const bestLabel = categoryLabels[best.category] || best.category;
  const planHorizonYears = horizonMap[riskLevel];

  logger.info(`Best performing category: ${bestLabel} (1Y: ${best.avg1Year?.toFixed(2) ?? 'NA'}%)`);
  logger.info('Recommended plan generated.');

  const summary = `Market momentum favors ${bestLabel} with annualized returns around ${best.avg1Year?.toFixed(2) ?? '0'}%.`;
  const reasoning = `Given a surplus of ₹${userSurplus.toLocaleString('en-IN')} and ${riskLevel} risk tolerance, this allocation balances growth and downside protection using current AMFI category performance.`;

  const allocationBreakdown: AllocationBreakdown[] = Object.entries(allocation).map(
    ([categoryKey, weight]) => {
      const categoryData =
        performance.find((item) => item.normalizedCategory === categoryKey) ??
        performance.find((item) => item.category === categoryKey);
      const label = categoryLabels[categoryKey] || categoryData?.category || categoryKey;
      const annualReturn = categoryData?.avg1Year ?? 0;
      const monthlyAmount = Math.round(userSurplus * weight);
      const projectionYears = Math.min(planHorizonYears, 5);
      const projection = Math.round(
        calculatePlanProjection(monthlyAmount, annualReturn, projectionYears)
      );

      return {
        category: categoryKey,
        label,
        percentage: Number((weight * 100).toFixed(0)),
        monthlyAmount,
        annualizedReturn: Number((annualReturn ?? 0).toFixed(2)),
        fiveYearProjection: projection,
        rationale: tiltRationale[categoryKey] || 'Supports diversified portfolio mix.',
      };
    }
  );

  const totalInvested = userSurplus * planHorizonYears * 12;
  const projectedValue = allocationBreakdown.reduce((sum, item) => sum + item.fiveYearProjection, 0);

  const actionChecklist = [
    `Save ₹${userSurplus.toLocaleString('en-IN')} every month for at least ${planHorizonYears} years.`,
    `Allocate funds according to the recommended ${riskLevel} risk mix and automate the SIPs.`,
    'Top up the SIP whenever surplus grows to accelerate the goal.',
    'Review this plan each quarter; rebalance if any category drifts more than 5%.',
  ];

  return {
    bestPerformingCategory: bestLabel,
    allocation,
    reasoning,
    summary,
    planHorizonYears,
    totalInvested,
    projectedValue: Math.round(projectedValue),
    actionChecklist,
    allocationBreakdown,
    categoryPerformance: performance.map((item) => ({
      category: item.category,
      normalizedCategory: item.normalizedCategory,
      avg1Month: item.avg1Month,
      avg3Month: item.avg3Month,
      avg1Year: item.avg1Year,
      updatedAt: item.updatedAt,
    })),
  };
};


