import { Schema, model, Document } from 'mongoose';

export type IPOStatus = 'upcoming' | 'open' | 'closed';
export type IssueType = 'book-built' | 'fixed-price';

export interface IIPO extends Document {
    companyName: string;
    symbol: string;
    industry: string;
    logo?: string;

    // Issue Details
    priceRange: {
        min: number;
        max: number;
    };
    lotSize: number;
    issueSize: string; // e.g., "₹500 Cr"
    issueType: IssueType;

    // Dates
    openDate: Date;
    closeDate: Date;
    listingDate?: Date;
    status: IPOStatus;

    // Company Information
    overview: string;
    strengths: string[];
    risks: string[];

    // Financial Highlights (Historical only)
    financialHighlights: {
        revenue?: string;
        profit?: string;
        year?: string;
    }[];

    // Documents
    drhpLink?: string;

    createdAt: Date;
    updatedAt: Date;
}

const IPOSchema = new Schema<IIPO>(
    {
        companyName: { type: String, required: true },
        symbol: { type: String, required: true, unique: true },
        industry: { type: String, required: true },
        logo: { type: String },

        priceRange: {
            min: { type: Number, required: true },
            max: { type: Number, required: true },
        },
        lotSize: { type: Number, required: true },
        issueSize: { type: String, required: true },
        issueType: { type: String, enum: ['book-built', 'fixed-price'], required: true },

        openDate: { type: Date, required: true },
        closeDate: { type: Date, required: true },
        listingDate: { type: Date },
        status: { type: String, enum: ['upcoming', 'open', 'closed'], required: true },

        overview: { type: String, required: true },
        strengths: [{ type: String }],
        risks: [{ type: String }],

        financialHighlights: [
            {
                revenue: String,
                profit: String,
                year: String,
            },
        ],

        drhpLink: { type: String },
    },
    { timestamps: true }
);

// Update status based on dates
// NOTE: Commented out to preserve status from seed data
// Uncomment if you want automatic status updates based on dates
/*
IPOSchema.pre('save', function (next) {
    const now = new Date();
    if (now < this.openDate) {
        this.status = 'upcoming';
    } else if (now >= this.openDate && now <= this.closeDate) {
        this.status = 'open';
    } else {
        this.status = 'closed';
    }
    next();
});
*/

export default model<IIPO>('IPO', IPOSchema);
