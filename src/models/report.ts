import mongoose, { Schema, Document } from 'mongoose';

export interface IReport extends Document {
    user: mongoose.Schema.Types.ObjectId;
    type: string;
    filePath: string;
    generatedAt: Date;
    status: 'pending' | 'completed' | 'failed';
}

const ReportSchema: Schema = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, default: 'financial-insight' },
    filePath: { type: String, required: true },
    generatedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
});

// Auto-expire reports after 24 hours (cleanup)
ReportSchema.index({ generatedAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model<IReport>('Report', ReportSchema);
