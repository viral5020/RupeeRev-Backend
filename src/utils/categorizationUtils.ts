/**
 * Merchant Categorization Utility
 * Auto-categorizes transactions based on merchant names and patterns
 */

export interface CategoryRule {
    category: string;
    keywords: string[];
    regex?: RegExp;
}

// Category rules for Indian merchants and common patterns
const CATEGORY_RULES: CategoryRule[] = [
    // Utilities - Electricity
    {
        category: 'Electricity',
        keywords: ['dgvcl', 'electric', 'power', 'mseb', 'bescom', 'tneb', 'electricity bill'],
        regex: /\b(dgvcl|electric|power|mseb|bescom|tneb)\b/i
    },

    // Food & Dining
    {
        category: 'Food & Dining',
        keywords: ['tea time tales', 'hotel', 'restaurant', 'cafe', 'chinese', 'pizza', 'burger', 'swiggy', 'zomato', 'dominos', 'mcdonald', 'kfc', 'subway', 'food'],
        regex: /\b(tea time tales|hotel|restaurant|cafe|chinese|pizza|burger|swiggy|zomato|dominos|mcdonald|kfc|subway|food|dining)\b/i
    },

    // Snacks & Tobacco
    {
        category: 'Snacks & Tobacco',
        keywords: ['pan center', 'pan centre', 'tobacco', 'cigarette', 'beedi'],
        regex: /\b(pan center|pan centre|tobacco|cigarette|beedi)\b/i
    },

    // Travel & Transport
    {
        category: 'Travel & Transport',
        keywords: ['irctc', 'rail', 'railway', 'flight', 'bus', 'uber', 'ola', 'rapido', 'metro', 'airline', 'indigo', 'spicejet', 'air india'],
        regex: /\b(irctc|rail|railway|flight|bus|uber|ola|rapido|metro|airline|indigo|spicejet|air india)\b/i
    },

    // Mobile Recharge & Telecom
    {
        category: 'Mobile Recharge',
        keywords: ['airtel', 'vi', 'vodafone', 'jio', 'bsnl', 'recharge', 'prepaid', 'postpaid', 'mobile'],
        regex: /\b(airtel|vodafone|vi|jio|bsnl|recharge|prepaid|postpaid)\b/i
    },

    // Fuel & Petrol
    {
        category: 'Fuel',
        keywords: ['petrol', 'petroleum', 'fuel', 'hp', 'bpcl', 'iocl', 'shell', 'reliance petroleum', 'diesel', 'cng'],
        regex: /\b(petrol|petroleum|fuel|hp|bpcl|iocl|shell|reliance petroleum|diesel|cng)\b/i
    },

    // Automobile & Vehicle
    {
        category: 'Automobile',
        keywords: ['motors', 'garage', 'auto', 'service center', 'car wash', 'vehicle', 'bike', 'scooter', 'tyre', 'spare parts'],
        regex: /\b(motors|garage|auto|service center|car wash|vehicle|bike|scooter|tyre|spare parts)\b/i
    },

    // Shopping & Retail
    {
        category: 'Shopping',
        keywords: ['furnishers', 'furniture', 'mall', 'amazon', 'flipkart', 'myntra', 'store', 'shop', 'retail', 'supermarket', 'dmart', 'reliance fresh', 'big bazaar'],
        regex: /\b(furnishers|furniture|mall|amazon|flipkart|myntra|store|shop|retail|supermarket|dmart|reliance fresh|big bazaar)\b/i
    },

    // Groceries
    {
        category: 'Groceries',
        keywords: ['grocery', 'kirana', 'vegetables', 'fruits', 'provisions', 'general store'],
        regex: /\b(grocery|kirana|vegetables|fruits|provisions|general store)\b/i
    },

    // Entertainment
    {
        category: 'Entertainment',
        keywords: ['netflix', 'amazon prime', 'hotstar', 'spotify', 'youtube', 'cinema', 'movie', 'pvr', 'inox', 'theatre'],
        regex: /\b(netflix|amazon prime|hotstar|spotify|youtube|cinema|movie|pvr|inox|theatre)\b/i
    },

    // Healthcare & Medical
    {
        category: 'Healthcare',
        keywords: ['hospital', 'clinic', 'pharmacy', 'medical', 'doctor', 'apollo', 'fortis', 'max healthcare', 'medicine', 'health'],
        regex: /\b(hospital|clinic|pharmacy|medical|doctor|apollo|fortis|max healthcare|medicine|health)\b/i
    },

    // Education
    {
        category: 'Education',
        keywords: ['school', 'college', 'university', 'tuition', 'course', 'coaching', 'education', 'fees'],
        regex: /\b(school|college|university|tuition|course|coaching|education|fees)\b/i
    },

    // Insurance
    {
        category: 'Insurance',
        keywords: ['insurance', 'lic', 'policy', 'premium'],
        regex: /\b(insurance|lic|policy|premium)\b/i
    },

    // Banking & Finance
    {
        category: 'Banking & Finance',
        keywords: ['bank', 'atm', 'loan', 'emi', 'credit card', 'debit card'],
        regex: /\b(bank|atm|loan|emi|credit card|debit card)\b/i
    },

    // Online Services & Subscriptions
    {
        category: 'Online Services',
        keywords: ['google', 'microsoft', 'adobe', 'subscription', 'saas', 'cloud'],
        regex: /\b(google|microsoft|adobe|subscription|saas|cloud)\b/i
    },
    // Rent
    {
        category: 'Rent',
        keywords: ['rent', 'housing', 'pg', 'hostel'],
        regex: /\b(rent|housing|pg|hostel)\b/i
    },

    // Income
    {
        category: 'Income',
        keywords: ['salary', 'bonus', 'credit', 'interest', 'dividend', 'refund'],
        regex: /\b(salary|bonus|credit|interest|dividend|refund)\b/i
    }
];

/**
 * Clean and normalize transaction data (Layer 1)
 */
export const cleanTransaction = (transaction: any): any => {
    // 1. Normalize amount: remove symbols and commas
    let amount = transaction.amount;
    if (typeof amount === 'string') {
        amount = parseFloat(amount.replace(/[^0-9.-]/g, ''));
    }

    // 2. Ensure type exists (infer from description or amount sign if missing)
    let type = transaction.type;
    if (!type) {
        if (amount < 0) {
            type = 'debit';
            amount = Math.abs(amount);
        } else if (transaction.description?.toLowerCase().includes('credit') ||
            transaction.description?.toLowerCase().includes('salary')) {
            type = 'credit';
        } else {
            type = 'debit'; // Default to debit for expenses
        }
    }

    // 3. Clean OCR text/description
    let description = transaction.description || transaction.title || 'Unknown Transaction';
    description = description.replace(/\s+/g, ' ').trim();

    // 4. Ensure date is valid
    let date = transaction.date;
    if (!date || isNaN(new Date(date).getTime())) {
        date = new Date().toISOString();
    }

    return {
        ...transaction,
        amount: amount || 0,
        type: type.toLowerCase(),
        description,
        title: description, // Keep title for compatibility
        date
    };
};

/**
 * Categorize a transaction based on its title/description (Layer 2)
 */
export const categorizeTransaction = (title: string): string => {
    if (!title || title.trim() === '') {
        return 'Others';
    }

    const normalizedTitle = title.toLowerCase().trim();

    // Check against all category rules
    for (const rule of CATEGORY_RULES) {
        // Check regex pattern
        if (rule.regex && rule.regex.test(normalizedTitle)) {
            return rule.category;
        }

        // Check keywords
        for (const keyword of rule.keywords) {
            if (normalizedTitle.includes(keyword.toLowerCase())) {
                return rule.category;
            }
        }
    }

    // Check if it's a personal transfer (person name pattern)
    if (isPersonalTransfer(normalizedTitle)) {
        return 'Personal Transfer';
    }

    return 'Others';
};

/**
 * Detect if transaction is a personal transfer based on name patterns
 */
const isPersonalTransfer = (title: string): boolean => {
    // Remove common corporate keywords
    const corporateKeywords = [
        'pvt', 'ltd', 'limited', 'inc', 'corp', 'company', 'co', 'llp',
        'services', 'solutions', 'technologies', 'systems', 'enterprises',
        'india', 'international', 'global', 'store', 'shop', 'mart'
    ];

    let cleanTitle = title.toLowerCase();
    for (const keyword of corporateKeywords) {
        cleanTitle = cleanTitle.replace(new RegExp(`\\b${keyword}\\b`, 'g'), '');
    }

    cleanTitle = cleanTitle.trim();

    // Check if it looks like a person name (2-3 words, mostly alphabetic)
    const words = cleanTitle.split(/\s+/).filter(w => w.length > 0);

    if (words.length >= 2 && words.length <= 4) {
        // Check if words are mostly alphabetic (person names)
        const isAlphabetic = words.every(word => /^[a-z]+$/.test(word));
        if (isAlphabetic) {
            return true;
        }
    }

    return false;
};

/**
 * Get all available categories
 */
export const getAllCategories = (): string[] => {
    const categories = CATEGORY_RULES.map(rule => rule.category);
    categories.push('Personal Transfer', 'Uncategorized');
    return [...new Set(categories)].sort();
};

/**
 * Batch categorize multiple transactions
 */
export const categorizeTransactions = (titles: string[]): Map<string, string> => {
    const results = new Map<string, string>();

    for (const title of titles) {
        results.set(title, categorizeTransaction(title));
    }

    return results;
};
