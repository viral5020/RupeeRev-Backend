import StockRecommendation from '../models/stockRecommendation';

export interface StockFilters {
    sector?: string;
    marketCap?: 'large' | 'mid' | 'small';
    riskLevel?: 'low' | 'medium' | 'high';
    investmentHorizon?: '1-3 years' | '3-5 years' | '5+ years';
    minUpside?: number;
}

export const getStockRecommendations = async (filters?: StockFilters) => {
    const query: any = { isActive: true };

    if (filters?.sector) {
        query.sector = filters.sector;
    }
    if (filters?.marketCap) {
        query.marketCap = filters.marketCap;
    }
    if (filters?.riskLevel) {
        query.riskLevel = filters.riskLevel;
    }
    if (filters?.investmentHorizon) {
        query.investmentHorizon = filters.investmentHorizon;
    }
    if (filters?.minUpside) {
        query.upside = { $gte: filters.minUpside };
    }

    return await StockRecommendation.find(query).sort({ recommendedAllocation: -1 });
};

export const getStockBySymbol = async (symbol: string) => {
    return await StockRecommendation.findOne({ symbol: symbol.toUpperCase(), isActive: true });
};

export const getTopPicks = async (limit: number = 5) => {
    return await StockRecommendation.find({ isActive: true })
        .sort({ recommendedAllocation: -1, upside: -1 })
        .limit(limit);
};

export const getStocksBySector = async () => {
    const stocks = await StockRecommendation.find({ isActive: true });

    const grouped = stocks.reduce((acc: any, stock) => {
        if (!acc[stock.sector]) {
            acc[stock.sector] = [];
        }
        acc[stock.sector].push(stock);
        return acc;
    }, {});

    return grouped;
};

export const getPortfolioSuggestion = async (
    investmentAmount: number,
    riskLevel: 'low' | 'medium' | 'high'
) => {
    // Get stocks matching risk level
    const stocks = await StockRecommendation.find({
        isActive: true,
        riskLevel: { $in: riskLevel === 'low' ? ['low'] : riskLevel === 'medium' ? ['low', 'medium'] : ['low', 'medium', 'high'] }
    }).sort({ recommendedAllocation: -1 });

    // Calculate allocation
    const totalAllocation = stocks.reduce((sum, stock) => sum + stock.recommendedAllocation, 0);

    const portfolio = stocks.map(stock => {
        const allocation = (stock.recommendedAllocation / totalAllocation) * investmentAmount;
        const shares = Math.floor(allocation / stock.currentPrice);
        const actualInvestment = shares * stock.currentPrice;

        return {
            symbol: stock.symbol,
            name: stock.name,
            sector: stock.sector,
            currentPrice: stock.currentPrice,
            targetPrice: stock.targetPrice,
            upside: stock.upside,
            recommendedAllocation: stock.recommendedAllocation,
            suggestedAmount: Math.round(allocation),
            suggestedShares: shares,
            actualInvestment: actualInvestment,
            rationale: stock.rationale,
        };
    });

    return {
        totalInvestment: investmentAmount,
        riskLevel,
        portfolio,
        diversification: {
            sectors: [...new Set(stocks.map(s => s.sector))].length,
            stocks: stocks.length,
        }
    };
};
