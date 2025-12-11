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

  pool.forEach((cat: any) => {
    const name = (cat.name || '').toLowerCase();
    if (!name) return;

    let score = 0;
    if (normalizedDesc.includes(name)) {
      score += 0.6;
    }

    const keywords: Record<string, string[]> = {
      groceries: ['grocery', 'supermarket', 'mart'],
      food: ['swiggy', 'zomato', 'restaurant', 'dine', 'burger', 'pizza'],
      travel: ['ola', 'uber', 'irctc', 'flight', 'hotel'],
      utilities: ['electricity', 'water bill', 'gas bill', 'dth', 'mobile recharge'],
      rent: ['rent'],
      salary: ['salary', 'payroll', 'credited by'],
      shopping: ['amazon', 'flipkart', 'myntra', 'ajio'],
      investment: ['sip', 'mutual fund', 'mf', 'insurance', 'lic'],
    };

    Object.entries(keywords).forEach(([key, list]) => {
      if (name.includes(key)) {
        list.forEach((kw) => {
          if (normalizedDesc.includes(kw)) score += 0.2;
        });
      }
    });

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


