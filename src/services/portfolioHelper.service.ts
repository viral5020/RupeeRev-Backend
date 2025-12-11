import MutualFund from '../models/mutualFund';
import logger from '../utils/logger';

export interface FundOverlap {
  funds: string[];
  overlapPercent: number;
  suggestion: string;
}

export interface AssetAllocation {
  equity: number;
  debt: number;
  gold: number;
  balanced: number;
  index: number;
  total: number;
  recommended: {
    equity: number;
    debt: number;
    gold: number;
    balanced: number;
    index: number;
  };
  health: 'good' | 'warning' | 'poor';
  message: string;
}

export const detectFundOverlap = async (userId: string, fundIds: string[]): Promise<FundOverlap[]> => {
  logger.info('Detecting fund overlap…');
  if (fundIds.length < 2) return [];

  const funds = await MutualFund.find({ _id: { $in: fundIds } });
  const overlaps: FundOverlap[] = [];

  for (let i = 0; i < funds.length; i++) {
    for (let j = i + 1; j < funds.length; j++) {
      const f1 = funds[i];
      const f2 = funds[j];

      if (f1.normalizedCategory === f2.normalizedCategory) {
        const overlap = 80; // Simplified: same category = high overlap
        overlaps.push({
          funds: [f1.name, f2.name],
          overlapPercent: overlap,
          suggestion: `These 2 funds have ${overlap}% overlap. Consider consolidating.`,
        });
      }
    }
  }

  // Group similar overlaps
  const grouped: FundOverlap[] = [];
  if (overlaps.length >= 3) {
    const categories = new Set(overlaps.map((o) => o.funds[0].split(' ')[0]));
    if (categories.size === 1) {
      grouped.push({
        funds: overlaps.slice(0, 3).flatMap((o) => o.funds),
        overlapPercent: 80,
        suggestion: `These ${overlaps.length} funds have 80% overlap. Suggested cleanup: Consolidate into 1-2 funds.`,
      });
    }
  }

  return grouped.length > 0 ? grouped : overlaps.slice(0, 3);
};

export const calculateAssetAllocation = async (
  userId: string,
  riskLevel: 'low' | 'medium' | 'high'
): Promise<AssetAllocation> => {
  logger.info(`Calculating asset allocation for risk level: ${riskLevel}`);
  
  // This would typically come from user's actual portfolio
  // For now, we'll use recommended allocation based on risk
  const recommended = {
    low: { equity: 20, debt: 50, gold: 20, balanced: 5, index: 5 },
    medium: { equity: 40, debt: 30, gold: 10, balanced: 15, index: 5 },
    high: { equity: 60, debt: 10, gold: 5, balanced: 20, index: 5 },
  };

  const target = recommended[riskLevel];
  
  // Placeholder: In real implementation, sum actual holdings
  const current = {
    equity: 0,
    debt: 0,
    gold: 0,
    balanced: 0,
    index: 0,
  };

  const total = Object.values(current).reduce((sum, v) => sum + v, 0);
  
  let health: 'good' | 'warning' | 'poor' = 'good';
  let message = 'Asset allocation matches your risk profile.';

  if (total === 0) {
    health = 'warning';
    message = 'No portfolio data available. Start investing to track allocation.';
  } else {
    const equityDiff = Math.abs((current.equity / total) * 100 - target.equity);
    const debtDiff = Math.abs((current.debt / total) * 100 - target.debt);
    
    if (equityDiff > 20 || debtDiff > 20) {
      health = 'poor';
      message = 'Asset allocation deviates significantly from recommended. Consider rebalancing.';
    } else if (equityDiff > 10 || debtDiff > 10) {
      health = 'warning';
      message = 'Asset allocation is slightly off. Consider minor rebalancing.';
    }
  }

  return {
    ...current,
    total,
    recommended: target,
    health,
    message,
  };
};

