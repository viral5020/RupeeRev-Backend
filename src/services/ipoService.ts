import IPO, { IIPO, IPOStatus } from '../models/ipo';
import IPOWatchlist from '../models/ipoWatchlist';
import { IUserDocument } from '../models/user';
import { loadIPOData } from './ipoDataLoader';

export interface IPOFilters {
    status?: IPOStatus;
    industry?: string;
    search?: string;
}

/**
 * Seed database with mock IPO data from JSON file
 * Call this once to populate the database
 */
export const seedIPOData = async () => {
    try {
        const existingCount = await IPO.countDocuments();
        if (existingCount > 0) {
            console.log('IPO data already exists, skipping seed');
            return;
        }

        const mockData = loadIPOData();
        await IPO.insertMany(mockData);
        console.log(`Successfully seeded ${mockData.length} IPOs`);
    } catch (error) {
        console.error('Error seeding IPO data:', error);
        throw error;
    }
};

export const listIPOs = async (filters: IPOFilters = {}) => {
    const query: any = {};

    if (filters.status) {
        query.status = filters.status;
    }

    if (filters.industry) {
        query.industry = filters.industry;
    }

    if (filters.search) {
        query.$or = [
            { companyName: { $regex: filters.search, $options: 'i' } },
            { symbol: { $regex: filters.search, $options: 'i' } },
        ];
    }

    return IPO.find(query).sort({ openDate: 1 });
};

export const getIPOById = async (id: string) => {
    return IPO.findById(id);
};

export const getUpcomingIPOs = async (limit: number = 3) => {
    // First, try to get IPOs with status 'upcoming'
    let upcomingIPOs = await IPO.find({ status: 'upcoming' })
        .sort({ openDate: 1 })
        .limit(limit);

    // Fallback: if no IPOs with 'upcoming' status, get IPOs with future open dates
    if (upcomingIPOs.length === 0) {
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 60); // Next 60 days

        upcomingIPOs = await IPO.find({
            openDate: { $gte: now, $lte: futureDate }
        })
            .sort({ openDate: 1 })
            .limit(limit);
    }

    return upcomingIPOs;
};

export const addToWatchlist = async (user: IUserDocument, ipoId: string) => {
    const ipo = await IPO.findById(ipoId);
    if (!ipo) {
        throw new Error('IPO not found');
    }

    const existing = await IPOWatchlist.findOne({ user: user.id, ipo: ipoId });
    if (existing) {
        return existing;
    }

    return IPOWatchlist.create({
        user: user.id,
        ipo: ipoId,
    });
};

export const removeFromWatchlist = async (user: IUserDocument, ipoId: string) => {
    const result = await IPOWatchlist.findOneAndDelete({ user: user.id, ipo: ipoId });
    if (!result) {
        throw new Error('IPO not in watchlist');
    }
    return result;
};

export const getUserWatchlist = async (user: IUserDocument) => {
    return IPOWatchlist.find({ user: user.id })
        .populate('ipo')
        .sort({ addedAt: -1 });
};

export const isInWatchlist = async (user: IUserDocument, ipoId: string) => {
    const item = await IPOWatchlist.findOne({ user: user.id, ipo: ipoId });
    return !!item;
};
