const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    type: {             // Cash or Bank
        type: String,
        enum: ['Cash', 'Bank'],
        required: true
    },
    mode: {             // Credit or Debit
        type: String,
        enum: ['Credit', 'Debit'],
        required: true
    },
    from: {             // From Whom
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
