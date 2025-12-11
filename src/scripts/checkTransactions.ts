import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Transaction from '../models/transaction';

dotenv.config();

const checkTransactions = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI!);
        console.log('✅ Connected to MongoDB\n');

        // Get all transactions
        const allTransactions = await Transaction.find({}).limit(10).lean();
        console.log(`📊 Total transactions found: ${allTransactions.length}\n`);

        if (allTransactions.length > 0) {
            console.log('🔍 Sample transactions:\n');
            allTransactions.forEach((txn, i) => {
                console.log(`${i + 1}. ${txn.title}`);
                console.log(`   Amount: ₹${txn.amount}`);
                console.log(`   Type: ${txn.type}`);
                console.log(`   Category: ${txn.category || 'MISSING ❌'}`);
                console.log(`   Account: ${(txn as any).account || 'MISSING ❌'}`);
                console.log(`   Source: ${txn.source || 'manual'}`);
                console.log(`   ImportedAt: ${txn.importedAt || 'N/A'}`);
                console.log('');
            });

            // Check for transactions without category or account
            const missingCategory = await Transaction.countDocuments({ category: { $exists: false } });
            const missingAccount = await Transaction.countDocuments({ account: { $exists: false } });
            const nullCategory = await Transaction.countDocuments({ category: null });
            const nullAccount = await Transaction.countDocuments({ account: null });

            console.log('\n⚠️ POTENTIAL ISSUES:');
            console.log(`   Transactions missing category field: ${missingCategory}`);
            console.log(`   Transactions with null category: ${nullCategory}`);
            console.log(`   Transactions missing account field: ${missingAccount}`);
            console.log(`   Transactions with null account: ${nullAccount}`);
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

checkTransactions();
