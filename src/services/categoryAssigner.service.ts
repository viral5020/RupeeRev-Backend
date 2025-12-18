import Category from '../models/category';
import UserCategoryLearning from '../models/userCategoryLearning';
import logger from '../utils/logger';

export type CategorySource = 'rule' | 'llm' | 'learning' | 'recurrence';

export interface CategoryAttempt {
  source: CategorySource | 'fallback';
  categoryId?: string;
  reason: string;
  score: number;
}

export interface CategoryAssignment {
  categoryId: string;
  source: CategorySource;
  confidence: number;
  attempts: CategoryAttempt[];
}

const normalizePattern = (text: string): string =>
  text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);

export const assignCategory = async (
  userId: string,
  description: string,
  categories: any[],
  txnType?: 'income' | 'expense'
): Promise<CategoryAssignment> => {
  const attempts: CategoryAttempt[] = [];
  const normalizedDesc = normalizePattern(description);

  const usableCategories = (categories || []).filter((cat: any) =>
    txnType ? cat.type === txnType : true
  );
  const pool: any[] = usableCategories.length > 0 ? usableCategories : (categories as any[] | undefined) || [];

  // 1) User learning (manual corrections history)
  const learning = await UserCategoryLearning.findOne({
    user: userId,
    pattern: normalizedDesc,
  });

  if (learning) {
    const confidence = Math.min(0.6 + learning.hits * 0.05, 0.95);
    attempts.push({
      source: 'learning',
      categoryId: learning.category.toString(),
      reason: `Matched user learning pattern "${normalizedDesc}" with ${learning.hits} hits`,
      score: confidence,
    });

    logger.info('Category assignment (learning)', {
      userId,
      pattern: normalizedDesc,
      categoryId: learning.category.toString(),
      confidence,
    });

    return {
      categoryId: learning.category.toString(),
      source: 'learning',
      confidence,
      attempts,
    };
  }

  // 2) Rule-based keyword matching against category names
  let bestRuleCategoryId: string | undefined;
  let bestScore = 0;

  const keywords: Record<string, string[]> = {
    groceries: ['grocery', 'supermarket', 'mart', 'blinkit', 'zepto', 'bigbasket', 'dmart', 'ratnadeep', 'more retail', 'reliance fresh', 'nature basket', 'store', 'market', 'dairy'],
    food: ['swiggy', 'zomato', 'restaurant', 'dine', 'burger', 'pizza', 'cafe', 'coffee', 'starbucks', 'mcdonalds', 'dominos', 'kfc', 'subway', 'sweet', 'bakery', 'hotel', 'kitchen', 'eats', 'food', 'pan', 'cold drink', 'colddrink', 'tea', 'beverages', 'nashta', 'bhojnalaya', 'dhaba'],
    travel: ['ola', 'uber', 'rapido', 'irctc', 'flight', 'airline', 'indigo', 'vistara', 'air india', 'train', 'rail', 'metro', 'bus', 'travel', 'trip', 'booking', 'mmt', 'makemytrip', 'goibibo', 'fuel', 'petrol', 'pump', 'shell', 'hpcl', 'bpcl', 'ioc', 'filling station', 'automotive'],
    utilities: ['electricity', 'water', 'gas', 'dth', 'mobile', 'recharge', 'bill', 'bescom', 'cesc', 'adani', 'jio', 'airtel', 'vi ', 'bsnl', 'broadband', 'internet', 'wifi'],
    rent: ['rent', 'landlord', 'housing', 'maintenance'],
    salary: ['salary', 'payroll', 'credited by', 'bonus', 'stipend'],
    shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tatacliq', 'decathlon', 'zara', 'h&m', 'trends', 'retail', 'shop', 'fashion', 'clothing'],
    investment: ['sip', 'mutual fund', 'mf', 'insurance', 'lic', 'zerodha', 'groww', 'upstox', 'angel one', 'ppf', 'epf', 'nps', 'premium'],
    medical: ['pharmacy', 'medical', 'hospital', 'clinic', 'doctor', 'dr.', 'health', 'lab', 'diagnostics', 'medplus', 'apollo', 'practo', '1mg'],
    entertainment: ['netflix', 'prime', 'hotstar', 'spotify', 'youtube', 'movie', 'cinema', 'inox', 'pvr', 'bookmyshow', 'game', 'playstation', 'steam'],
    transfer: ['upi', 'transfer', 'sent to', 'received from', 'upi lite']
  };

  // CHECK KETWORDS
  Object.entries(keywords).forEach(([key, list]) => {
    // Check if pool has a category that matches this key loosely
    const targetCategory = pool.find(c => {
      const cName = (c.name || '').toLowerCase();
      if (cName.includes(key)) return true;
      if (key === 'medical' && cName.includes('health')) return true;
      if (key === 'utilities' && cName.includes('bill')) return true;
      if (key === 'transfer' && (cName.includes('transfer') || cName.includes('money'))) return true;
      return false;
    });

    if (targetCategory && list.some(kw => normalizedDesc.includes(kw))) {
      // Found match
      const scoreVal = list.some(kw => normalizedDesc === kw) ? 0.9 : 0.7; // Exact match higher
      if (scoreVal > bestScore) {
        bestScore = scoreVal;
        bestRuleCategoryId = targetCategory._id.toString();
      }
    }
  });

  // CHECK NAME MATCH
  pool.forEach((cat: any) => {
    const name = (cat.name || '').toLowerCase();
    if (!name) return;

    let score = 0;
    if (normalizedDesc.includes(name)) {
      score += 0.6;
    }

    if (score > bestScore) {
      bestScore = score;
      bestRuleCategoryId = cat._id.toString();
    }
  });

  if (bestRuleCategoryId) {
    const confidence = Math.min(bestScore, 0.8);
    attempts.push({
      source: 'rule',
      categoryId: bestRuleCategoryId,
      reason: 'Matched rule-based keyword pattern',
      score: bestScore,
    });

    logger.info('Category assignment (rule)', {
      userId,
      pattern: normalizedDesc,
      categoryId: bestRuleCategoryId,
      confidence,
    });

    return {
      categoryId: bestRuleCategoryId,
      source: 'rule',
      confidence,
      attempts,
    };
  }

  // 3) Fallback: Other / first category with low confidence
  const fallbackCategory =
    pool.find((c: any) => {
      const name = (c.name || '').toLowerCase();
      return name.includes('other') || name.includes('misc') || name.includes('uncategorized');
    }) || (pool[0] as any);
  const fallbackId = fallbackCategory?._id.toString();

  attempts.push({
    source: 'fallback',
    categoryId: fallbackId,
    reason: 'No strong match, using fallback category',
    score: 0.3,
  });

  logger.info('Category assignment (fallback)', { userId, pattern: normalizedDesc, categoryId: fallbackId });

  return {
    categoryId: fallbackId,
    source: 'rule',
    confidence: 0.3,
    attempts,
  };
};
