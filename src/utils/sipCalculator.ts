import logger from './logger';

export interface SipDurationResult {
  expectedMonths: number;
  expectedYears: number;
  minimumTenureApplied?: boolean;
  note?: string;
}

const roundYears = (months: number) => Number((months / 12).toFixed(1));

export const calculateSipDuration = (
  targetAmount: number,
  monthlyInvestment: number,
  annualReturnPercent: number
): SipDurationResult => {
  logger.info(`Calculating SIP duration for target ₹${targetAmount}…`, {
    monthlyInvestment,
    annualReturnPercent,
  });

  if (monthlyInvestment <= 0 || targetAmount <= 0) {
    return { expectedMonths: 0, expectedYears: 0 };
  }

  const monthlyRate = annualReturnPercent > 0 ? annualReturnPercent / 100 / 12 : 0;
  let months = 0;

  if (monthlyRate <= 0) {
    months = Math.ceil(targetAmount / monthlyInvestment);
  } else {
    // Formula: n = log((target * r / SIP) + 1) / log(1 + r)
    const term = (targetAmount * monthlyRate) / monthlyInvestment;
    const base = term + 1;

    if (base <= 1) {
      months = Math.ceil(targetAmount / monthlyInvestment);
    } else {
      months = Math.ceil(Math.log(base) / Math.log(1 + monthlyRate));
    }
  }

  if (months < 12) {
    logger.info(`Expected time ${months} months < 12. Enforcing minimum SIP tenure.`);
    return {
      expectedMonths: 12,
      expectedYears: 1,
      minimumTenureApplied: true,
      note: 'SIP requires minimum recommended duration of 1 year. Shorter timelines are considered savings, not SIP.',
    };
  }

  if (months > 360) {
    logger.info(`Expected time ${months} months > 360. Adding warning.`);
    return {
      expectedMonths: months,
      expectedYears: roundYears(months),
      note: 'Timeline too long. Consider increasing SIP or lowering goal.',
    };
  }

  logger.info(`Expected time: ${months} months (~${roundYears(months)} years)`);
  return { expectedMonths: months, expectedYears: roundYears(months) };
};

export default calculateSipDuration;



