import mongoose from 'mongoose';
import env from '../config/env';

const fixUserIndexes = async () => {
    try {
        await mongoose.connect(env.mongoUri);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        if (!db) {
            throw new Error('Database connection not established');
        }

        const usersCollection = db.collection('users');

        // Get all indexes
        const indexes = await usersCollection.indexes();
        console.log('Current indexes:', indexes);

        // Drop the problematic username index if it exists
        try {
            await usersCollection.dropIndex('username_1');
            console.log('✅ Dropped username_1 index');
        } catch (error: any) {
            if (error.code === 27) {
                console.log('Index username_1 does not exist, skipping');
            } else {
                throw error;
            }
        }

        console.log('✅ Index fix complete');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error fixing indexes:', error);
        process.exit(1);
    }
};

fixUserIndexes();
