import StockRecommendation from '../models/stockRecommendation';

export const seedStockRecommendations = async () => {
    const count = await StockRecommendation.countDocuments();

    if (count > 0) {
        console.log('Stock recommendations already seeded');
        return;
    }

    const stocks = [
        // LARGE CAP - LOW RISK
        {
            symbol: 'RELIANCE',
            name: 'Reliance Industries Ltd',
            sector: 'Energy & Petrochemicals',
            marketCap: 'large',
            currentPrice: 2450,
            targetPrice: 3200,
            upside: 30.6,
            investmentHorizon: '3-5 years',
            riskLevel: 'low',
            rationale: 'Diversified conglomerate with strong presence in energy, retail, and telecom. Jio and retail segments driving growth.',
            keyStrengths: [
                'Market leader in multiple sectors',
                'Strong balance sheet and cash flows',
                'Digital transformation through Jio',
                'Expanding retail footprint'
            ],
            risks: [
                'Regulatory challenges in telecom',
                'Oil price volatility',
                'High debt levels'
            ],
            dividendYield: 0.3,
            peRatio: 24.5,
            recommendedAllocation: 15,
            isActive: true,
        },
        {
            symbol: 'HDFCBANK',
            name: 'HDFC Bank Ltd',
            sector: 'Banking & Financial Services',
            marketCap: 'large',
            currentPrice: 1650,
            targetPrice: 2100,
            upside: 27.3,
            investmentHorizon: '3-5 years',
            riskLevel: 'low',
            rationale: 'India\'s largest private sector bank with consistent performance, strong asset quality, and digital banking leadership.',
            keyStrengths: [
                'Best-in-class asset quality',
                'Strong deposit franchise',
                'Digital banking innovation',
                'Consistent profitability'
            ],
            risks: [
                'Economic slowdown impact',
                'Rising competition',
                'NPA concerns in stressed sectors'
            ],
            dividendYield: 1.2,
            peRatio: 19.8,
            recommendedAllocation: 15,
            isActive: true,
        },
        {
            symbol: 'TCS',
            name: 'Tata Consultancy Services',
            sector: 'Information Technology',
            marketCap: 'large',
            currentPrice: 3850,
            targetPrice: 4800,
            upside: 24.7,
            investmentHorizon: '3-5 years',
            riskLevel: 'low',
            rationale: 'India\'s largest IT services company with global presence, strong client relationships, and digital transformation expertise.',
            keyStrengths: [
                'Market leader in IT services',
                'Strong client retention',
                'High operating margins',
                'Consistent dividend payer'
            ],
            risks: [
                'Currency fluctuations',
                'Client concentration',
                'Wage inflation'
            ],
            dividendYield: 2.8,
            peRatio: 28.3,
            recommendedAllocation: 12,
            isActive: true,
        },

        // LARGE CAP - MEDIUM RISK
        {
            symbol: 'INFY',
            name: 'Infosys Ltd',
            sector: 'Information Technology',
            marketCap: 'large',
            currentPrice: 1580,
            targetPrice: 2000,
            upside: 26.6,
            investmentHorizon: '3-5 years',
            riskLevel: 'medium',
            rationale: 'Leading IT services with strong digital capabilities, cloud expertise, and expanding consulting business.',
            keyStrengths: [
                'Strong digital revenue growth',
                'Robust deal pipeline',
                'Good corporate governance',
                'High cash generation'
            ],
            risks: [
                'Attrition challenges',
                'Margin pressure',
                'Geopolitical uncertainties'
            ],
            dividendYield: 2.5,
            peRatio: 26.1,
            recommendedAllocation: 10,
            isActive: true,
        },
        {
            symbol: 'ASIANPAINT',
            name: 'Asian Paints Ltd',
            sector: 'Consumer Goods',
            marketCap: 'large',
            currentPrice: 2950,
            targetPrice: 3600,
            upside: 22.0,
            investmentHorizon: '3-5 years',
            riskLevel: 'medium',
            rationale: 'Market leader in decorative paints with strong brand, distribution network, and innovation capabilities.',
            keyStrengths: [
                'Dominant market share',
                'Strong brand equity',
                'Extensive distribution',
                'Innovation in products'
            ],
            risks: [
                'Raw material price volatility',
                'Increasing competition',
                'Real estate slowdown impact'
            ],
            dividendYield: 0.8,
            peRatio: 58.2,
            recommendedAllocation: 8,
            isActive: true,
        },

        // MID CAP - MEDIUM TO HIGH RISK
        {
            symbol: 'DMART',
            name: 'Avenue Supermarts (DMart)',
            sector: 'Retail',
            marketCap: 'mid',
            currentPrice: 3800,
            targetPrice: 5200,
            upside: 36.8,
            investmentHorizon: '5+ years',
            riskLevel: 'medium',
            rationale: 'Leading value retail chain with strong unit economics, owned real estate model, and consistent expansion.',
            keyStrengths: [
                'Efficient business model',
                'Owned store format',
                'Strong same-store growth',
                'Expanding footprint'
            ],
            risks: [
                'E-commerce competition',
                'Execution risks in expansion',
                'Valuation concerns'
            ],
            dividendYield: 0.2,
            peRatio: 95.4,
            recommendedAllocation: 7,
            isActive: true,
        },
        {
            symbol: 'BAJFINANCE',
            name: 'Bajaj Finance Ltd',
            sector: 'Non-Banking Financial Company',
            marketCap: 'large',
            currentPrice: 6850,
            targetPrice: 9000,
            upside: 31.4,
            investmentHorizon: '3-5 years',
            riskLevel: 'medium',
            rationale: 'Leading consumer finance company with diversified product portfolio, strong digital platform, and robust growth.',
            keyStrengths: [
                'Strong AUM growth',
                'Digital-first approach',
                'Diversified product mix',
                'Excellent asset quality'
            ],
            risks: [
                'Economic slowdown impact',
                'Rising competition',
                'Regulatory changes'
            ],
            dividendYield: 0.3,
            peRatio: 32.5,
            recommendedAllocation: 10,
            isActive: true,
        },
        {
            symbol: 'TITAN',
            name: 'Titan Company Ltd',
            sector: 'Consumer Discretionary',
            marketCap: 'large',
            currentPrice: 3200,
            targetPrice: 4100,
            upside: 28.1,
            investmentHorizon: '3-5 years',
            riskLevel: 'medium',
            rationale: 'Market leader in watches and jewelry with strong brand portfolio, omnichannel presence, and premiumization trend.',
            keyStrengths: [
                'Strong brand portfolio',
                'Market leadership',
                'Omnichannel strategy',
                'Beneficiary of premiumization'
            ],
            risks: [
                'Gold price volatility',
                'Discretionary spending slowdown',
                'Competition in jewelry'
            ],
            dividendYield: 0.4,
            peRatio: 78.6,
            recommendedAllocation: 6,
            isActive: true,
        },

        // SECTORAL OPPORTUNITIES
        {
            symbol: 'ICICIBANK',
            name: 'ICICI Bank Ltd',
            sector: 'Banking & Financial Services',
            marketCap: 'large',
            currentPrice: 1150,
            targetPrice: 1500,
            upside: 30.4,
            investmentHorizon: '3-5 years',
            riskLevel: 'medium',
            rationale: 'Second-largest private bank with improving asset quality, strong retail franchise, and digital transformation.',
            keyStrengths: [
                'Improving asset quality',
                'Strong retail growth',
                'Digital banking leadership',
                'Diversified revenue streams'
            ],
            risks: [
                'Asset quality concerns',
                'Economic slowdown',
                'Regulatory changes'
            ],
            dividendYield: 0.9,
            peRatio: 18.2,
            recommendedAllocation: 12,
            isActive: true,
        },
        {
            symbol: 'LTIM',
            name: 'LTIMindtree Ltd',
            sector: 'Information Technology',
            marketCap: 'large',
            currentPrice: 5800,
            targetPrice: 7500,
            upside: 29.3,
            investmentHorizon: '3-5 years',
            riskLevel: 'medium',
            rationale: 'Merged entity with strong capabilities in digital, cloud, and engineering services. Synergy benefits expected.',
            keyStrengths: [
                'Strong digital capabilities',
                'Merger synergies',
                'Diversified client base',
                'Focus on high-growth areas'
            ],
            risks: [
                'Integration challenges',
                'Client concentration',
                'Margin pressure'
            ],
            dividendYield: 2.1,
            peRatio: 31.8,
            recommendedAllocation: 5,
            isActive: true,
        },
    ];

    await StockRecommendation.insertMany(stocks);
    console.log('✅ Stock recommendations seeded successfully');
};
