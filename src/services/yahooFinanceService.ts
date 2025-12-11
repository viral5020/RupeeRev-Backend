import yahooFinance from 'yahoo-finance2';
import logger from '../utils/logger';

// Map Indian stock symbols to Yahoo Finance format (NSE symbols need .NS suffix)
const YAHOO_SYMBOL_MAP: Record<string, string> = {
    'RELIANCE': 'RELIANCE.NS',
    'HDFCBANK': 'HDFCBANK.NS',
    'TCS': 'TCS.NS',
    'INFY': 'INFY.NS',
    'ASIANPAINT': 'ASIANPAINT.NS',
    'DMART': 'DMART.NS',
    'BAJFINANCE': 'BAJFINANCE.NS',
    'TITAN': 'TITAN.NS',
    'ICICIBANK': 'ICICIBANK.NS',
    'LTIM': 'LTIM.NS',
};

export interface LiveStockData {
    symbol: string;
    currentPrice: number;
    previousClose: number;
    change: number;
    changePercent: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    marketCap?: number;
    peRatio?: number;
    dividendYield?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
}

export const fetchLiveStockPrice = async (symbol: string): Promise<LiveStockData | null> => {
    try {
        const yahooSymbol = YAHOO_SYMBOL_MAP[symbol] || `${symbol}.NS`;

        const quote = await yahooFinance.quote(yahooSymbol) as any;

        if (!quote || !quote.regularMarketPrice) {
            logger.warn(`No data found for symbol: ${symbol}`);
            return null;
        }

        return {
            symbol,
            currentPrice: quote.regularMarketPrice,
            previousClose: quote.regularMarketPreviousClose || quote.regularMarketPrice,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            dayHigh: quote.regularMarketDayHigh || quote.regularMarketPrice,
            dayLow: quote.regularMarketDayLow || quote.regularMarketPrice,
            volume: quote.regularMarketVolume || 0,
            marketCap: quote.marketCap,
            peRatio: quote.trailingPE,
            dividendYield: quote.dividendYield ? quote.dividendYield * 100 : undefined,
            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        };
    } catch (error: any) {
        logger.error(`Error fetching stock data for ${symbol}:`, error.message);
        return null;
    }
};

export const fetchMultipleStockPrices = async (symbols: string[]): Promise<Record<string, LiveStockData>> => {
    const results: Record<string, LiveStockData> = {};

    // Fetch in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const promises = batch.map(symbol => fetchLiveStockPrice(symbol));
        const batchResults = await Promise.all(promises);

        batchResults.forEach((data, index) => {
            if (data) {
                results[batch[index]] = data;
            }
        });

        // Small delay between batches
        if (i + batchSize < symbols.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return results;
};

export const getStockFundamentals = async (symbol: string) => {
    try {
        const yahooSymbol = YAHOO_SYMBOL_MAP[symbol] || `${symbol}.NS`;

        const [quote, summary] = await Promise.all([
            yahooFinance.quote(yahooSymbol),
            (yahooFinance.quoteSummary(yahooSymbol, {
                modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData']
            }) as any).catch((_err: any) => null)
        ]);

        return {
            quote,
            summary,
        };
    } catch (error: any) {
        logger.error(`Error fetching fundamentals for ${symbol}:`, error.message);
        return null;
    }
};
