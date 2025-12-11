const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction');

// Add transaction
router.post('/', async (req, res) => {
    try {
        const { type, mode, from, amount } = req.body;

        if (!type || !mode || !from || !amount) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const transaction = new Transaction({ type, mode, from, amount });
        const savedTransaction = await transaction.save();

        res.status(201).json(savedTransaction); // return saved transaction with mode
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error adding transaction", error: err.message });
    }
});

// Get all transactions
router.get('/', async (req, res) => {
    try {
        const transactions = await Transaction.find().sort({ date: 1 });
        res.json(transactions); // send array of transactions
    } catch (err) {
        res.status(500).json({ message: "Error fetching transactions", error: err.message });
    }
});

module.exports = router;
