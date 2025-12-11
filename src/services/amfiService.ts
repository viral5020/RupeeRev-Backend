import axios from 'axios';
import dayjs from 'dayjs';
import MutualFund, { INavHistoryEntry, NormalizedCategory } from '../models/mutualFund';
import logger from '../utils/logger';
import { calculateCategoryPerformance } from './categoryPerformanceService';

const AMFI_URL = process.env.AMFI_FUND_URL || 'https://www.amfiindia.com/spages/NAVAll.txt';
const MAX_HISTORY_ENTRIES = 400;

const defaultReturnBenchmarks: Record<
  NormalizedCategory,
  { oneDayReturn: number; oneMonthReturn: number; threeMonthReturn: number; oneYearReturn: number }
> = {
  index: { oneDayReturn: 0.05, oneMonthReturn: 1.2, threeMonthReturn: 3.4, oneYearReturn: 12 },
  equity: { oneDayReturn: 0.07, oneMonthReturn: 1.8, threeMonthReturn: 5.2, oneYearReturn: 15 },
  balanced: { oneDayReturn: 0.04, oneMonthReturn: 1.4, threeMonthReturn: 3.8, oneYearReturn: 10 },
  gold: { oneDayReturn: 0.06, oneMonthReturn: 2.1, threeMonthReturn: 6.3, oneYearReturn: 14 },
  debt: { oneDayReturn: 0.02, oneMonthReturn: 0.8, threeMonthReturn: 2.1, oneYearReturn: 7 },
};

export interface ParsedFundRow {
  schemeCode: string;
  name: string;
  nav: number;
  date: Date;
  category: string;
  normalizedCategory: NormalizedCategory;
}

const categoryLabelMap: Record<NormalizedCategory, string[]> = {
  index: ['index', 'nifty', 'sensex', 'etf'],
  equity: ['large cap', 'bluechip', 'equity', 'flexicap', 'mid cap', 'small cap'],
  balanced: ['balanced', 'hybrid', 'aggressive hybrid', 'asset allocation'],
  gold: ['gold', 'precious'],
  debt: ['debt', 'liquid', 'bond', 'income', 'gilt', 'overnight', 'money market'],
};

const normalizeCategory = (category: string, name: string): NormalizedCategory => {
  const text = `${category} ${name}`.toLowerCase();

  if (categoryLabelMap.index.some((token) => text.includes(token))) return 'index';
  if (categoryLabelMap.gold.some((token) => text.includes(token))) return 'gold';
  if (categoryLabelMap.balanced.some((token) => text.includes(token))) return 'balanced';
  if (categoryLabelMap.debt.some((token) => text.includes(token))) return 'debt';
  if (text.includes('hybrid') || text.includes('balanced')) return 'balanced';
  if (text.includes('gold')) return 'gold';
  if (text.includes('debt') || text.includes('liquid')) return 'debt';

  return 'equity';
};

const parseAmfiFile = (raw: string): ParsedFundRow[] => {
  const lines = raw.split('\n');
  const funds: ParsedFundRow[] = [];
  let currentCategory = 'Uncategorized';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('Scheme Code')) continue;

    const columns = trimmed.split(';');

    if (columns.length < 6) {
      currentCategory = trimmed;
      continue;
    }

    const [schemeCode, , , schemeName, navValue, dateValue] = columns;

    const nav = Number(navValue);
    const parsedDate = dayjs(dateValue, ['DD-MMM-YYYY', 'DD/MM/YYYY'], true);

    if (!schemeCode || Number.isNaN(nav) || !schemeName || !parsedDate.isValid()) continue;

    funds.push({
      schemeCode: schemeCode.trim(),
      name: schemeName.trim(),
      nav,
      date: parsedDate.toDate(),
      category: currentCategory,
      normalizedCategory: normalizeCategory(currentCategory, schemeName),
    });
  }

  return funds;
};

const insertOrUpdateFund = async (fund: ParsedFundRow) => {
  const existing = await MutualFund.findOne({ schemeCode: fund.schemeCode });
  const history: INavHistoryEntry[] = existing ? [...existing.navHistory] : [];

  const nextHistory = history.filter((entry) => !dayjs(entry.date).isSame(fund.date, 'day'));
  nextHistory.push({ date: fund.date, nav: fund.nav });
  nextHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  while (nextHistory.length > MAX_HISTORY_ENTRIES) {
    nextHistory.shift();
  }

  const returns = calculateReturns(nextHistory, fund.nav, fund.date, fund.normalizedCategory);

  if (existing) {
    existing.name = fund.name;
    existing.nav = fund.nav;
    existing.date = fund.date;
    existing.category = fund.category;
    existing.normalizedCategory = fund.normalizedCategory;
    existing.navHistory = nextHistory;
    existing.oneDayReturn = returns.oneDayReturn;
    existing.oneMonthReturn = returns.oneMonthReturn;
    existing.threeMonthReturn = returns.threeMonthReturn;
    existing.oneYearReturn = returns.oneYearReturn;
    await existing.save();
    return 'updated';
  }

  await MutualFund.create({
    ...fund,
    navHistory: nextHistory,
    ...returns,
  });
  return 'created';
};

const calculateReturns = (
  history: INavHistoryEntry[],
  latestNav: number,
  latestDate: Date,
  normalizedCategory: NormalizedCategory
) => {
  const computeChange = (targetDate: Date) => {
    const reference = [...history]
      .reverse()
      .find((entry) => dayjs(entry.date).isSame(targetDate, 'day') || dayjs(entry.date).isBefore(targetDate));
    if (!reference || reference.nav === 0) return undefined;
    return Number((((latestNav - reference.nav) / reference.nav) * 100).toFixed(2));
  };

  const defaults = defaultReturnBenchmarks[normalizedCategory];

  return {
    oneDayReturn: computeChange(dayjs(latestDate).subtract(1, 'day').toDate()) ?? defaults.oneDayReturn,
    oneMonthReturn: computeChange(dayjs(latestDate).subtract(1, 'month').toDate()) ?? defaults.oneMonthReturn,
    threeMonthReturn: computeChange(dayjs(latestDate).subtract(3, 'month').toDate()) ?? defaults.threeMonthReturn,
    oneYearReturn: computeChange(dayjs(latestDate).subtract(1, 'year').toDate()) ?? defaults.oneYearReturn,
  };
};

export const syncAmfiData = async () => {
  logger.info('Fetching AMFI data…');
  const response = await axios.get<string>(AMFI_URL, { responseType: 'text' });
  logger.info('Parsing AMFI file…');
  const funds = parseAmfiFile(response.data);
  logger.info(`Saving ${funds.length} funds…`);

  let updated = 0;
  let created = 0;

  for (const fund of funds) {
    try {
      const status = await insertOrUpdateFund(fund);
      if (status === 'updated') updated += 1;
      else created += 1;
    } catch (error) {
      logger.error(`Failed to persist fund ${fund.schemeCode}`, { error });
    }
  }

  logger.info(`Updated NAV for ${updated} funds`);
  logger.info(`Created ${created} new funds`);
  await calculateCategoryPerformance();
  logger.info('AMFI sync complete.');
};


