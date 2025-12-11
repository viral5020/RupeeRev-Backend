import { Schema, model, Document } from 'mongoose';

export interface IReview extends Document {
    userId: Schema.Types.ObjectId;
    name: string;
    role?: string;
    rating: number;
    content: string;
    verified: boolean;
    isApproved: boolean;
    avatarUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true, // One review per user
        },
        name: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            maxlength: 50,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        content: {
            type: String,
            required: true,
            minlength: 10,
            maxlength: 500,
        },
        verified: {
            type: Boolean,
            default: true,
        },
        isApproved: {
            type: Boolean,
            default: true,
        },
        avatarUrl: {
            type: String,
        },
    },
    { timestamps: true }
);

// Index for faster queries
ReviewSchema.index({ isApproved: 1, createdAt: -1 });

export const Review = model<IReview>('Review', ReviewSchema);
export default Review;
