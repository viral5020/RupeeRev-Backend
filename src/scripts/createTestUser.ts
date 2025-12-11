import mongoose from 'mongoose';
import User from '../models/user';
import env from '../config/env';

const createTestUser = async () => {
    try {
        await mongoose.connect(env.mongoUri);
        console.log('Connected to MongoDB');

        // Check if user already exists
        const existing = await User.findOne({ email: 'test@example.com' });
        if (existing) {
            console.log('Test user already exists');
            console.log('Email: test@example.com');
            console.log('Password: password123');
            await mongoose.disconnect();
            process.exit(0);
            return;
        }

        // Create test user
        const user = await User.create({
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123',
        });

        console.log('✅ Test user created successfully!');
        console.log('Email: test@example.com');
        console.log('Password: password123');
        console.log('\nYou can now login with these credentials.');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error creating test user:', error);
        process.exit(1);
    }
};

createTestUser();
