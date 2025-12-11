import cron from 'node-cron';
import StockRecommendation from '../models/stockRecommendation';
import { fetchMultipleStockPrices } from '../services/yahooFinanceService';
import logger from '../utils/logger';

export const startStockPriceUpdateJob = () => {
    // Run every day at 6 PM IST (market close time)
    cron.schedule('0 18 * * 1-5', async () => {
        try {
            logger.info('Starting stock price update job...');

            const stocks = await StockRecommendation.find({ isActive: true });
            const symbols = stocks.map(s => s.symbol);

            logger.info(`Fetching live prices for ${symbols.length} stocks...`);
            const liveData = await fetchMultipleStockPrices(symbols);

            let updatedCount = 0;
            for (const stock of stocks) {
                const live = liveData[stock.symbol];
                if (live) {
                    stock.currentPrice = live.currentPrice;
                    if (live.peRatio) stock.peRatio = live.peRatio;
                    if (live.dividendYield) stock.dividendYield = live.dividendYield;

                    // Recalculate upside based on new current price
                    stock.upside = ((stock.targetPrice - stock.currentPrice) / stock.currentPrice) * 100;

                    stock.lastUpdated = new Date();
                    await stock.save();
                    updatedCount++;
                }
            }

            logger.info(`✅ Stock price update completed. Updated ${updatedCount}/${symbols.length} stocks.`);
        } catch (error: any) {
            logger.error('Error updating stock prices:', error.message);
        }
    }, {
        timezone: 'Asia/Kolkata'
    });

    logger.info('📈 Stock price update job scheduled (Daily at 6 PM IST, Mon-Fri)');
};

// Manual trigger function for immediate update
export const updateStockPricesNow = async () => {
    try {
        logger.info('Manual stock price update triggered...');

        const stocks = await StockRecommendation.find({ isActive: true });
        const symbols = stocks.map(s => s.symbol);

        const liveData = await fetchMultipleStockPrices(symbols);

        let updatedCount = 0;
        for (const stock of stocks) {
            const live = liveData[stock.symbol];
            if (live) {
                stock.currentPrice = live.currentPrice;
                if (live.peRatio) stock.peRatio = live.peRatio;
                if (live.dividendYield) stock.dividendYield = live.dividendYield;
                stock.upside = ((stock.targetPrice - stock.currentPrice) / stock.currentPrice) * 100;
                stock.lastUpdated = new Date();
                await stock.save();
                updatedCount++;
            }
        }

        logger.info(`✅ Manual update completed. Updated ${updatedCount}/${symbols.length} stocks.`);
        return { success: true, updated: updatedCount, total: symbols.length };
    } catch (error: any) {
        logger.error('Error in manual stock price update:', error.message);
        throw error;
    }
};
