import { Schema, model, Document, Types } from 'mongoose';

export interface IIPOWatchlist extends Document {
    user: Types.ObjectId;
    ipo: Types.ObjectId;
    notifyOnOpen: boolean;
    notifyOnClose: boolean;
    addedAt: Date;
}

const IPOWatchlistSchema = new Schema<IIPOWatchlist>(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        ipo: { type: Schema.Types.ObjectId, ref: 'IPO', required: true },
        notifyOnOpen: { type: Boolean, default: true },
        notifyOnClose: { type: Boolean, default: true },
        addedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

// Ensure user can't add same IPO twice
IPOWatchlistSchema.index({ user: 1, ipo: 1 }, { unique: true });

export default model<IIPOWatchlist>('IPOWatchlist', IPOWatchlistSchema);
