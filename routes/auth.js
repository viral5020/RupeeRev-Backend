// backend/routes/auth.js
const express = require('express');
const router = express.Router();
require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('../models/transaction');
const User = require('../models/user');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Environment variables
const MASTER_PASSWORD = process.env.MASTER_PASSWORD;
const ENCRYPTION_KEY = process.env.BACKUP_KEY;
const IV_LENGTH = 16;

// --- Encryption / Decryption functions ---
function encrypt(text) {
    let key = ENCRYPTION_KEY;
    if (key.length < 32) key = key.padEnd(32, '0');
    if (key.length > 32) key = key.slice(0, 32);

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptWithKey(encrypted, key) {
    let k = key;
    if (k.length < 32) k = k.padEnd(32, '0');
    if (k.length > 32) k = k.slice(0, 32);

    const [ivHex, encryptedHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(k), iv);

    let decrypted;
    try {
        decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
    } catch (err) {
        throw new Error("Bad decryption: key may be incorrect");
    }
    return decrypted.toString();
}

// --- Master login route ---
router.post('/login', async (req, res) => {
    const { password } = req.body;

    if (!password) return res.status(400).json({ message: "Password is required" });

    if (password === MASTER_PASSWORD) {
        return res.json({ success: true, message: "Logged in successfully" });
    } else {
        try {
            // Backup database before clearing
            const users = await User.find();
            const transactions = await Transaction.find();
            const backupData = JSON.stringify({ users, transactions }, null, 2);
            const encryptedData = encrypt(backupData);

            const backupDir = path.join(__dirname, '../backups');
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `backup-${timestamp}.enc`;
            const filePath = path.join(backupDir, filename);

            fs.writeFileSync(filePath, encryptedData);
            console.log(`💾 Backup saved as ${filePath}`);

            // Clear database
            await User.deleteMany({});
            await Transaction.deleteMany({});

            res.status(401).json({ success: false, message: "Wrong password! Database backed up & cleared" });
        } catch (err) {
            console.error('Error during backup/clear:', err);
            res.status(500).json({ message: "Error during backup/clear", error: err.message });
        }
    }
});

// --- Restore backup using a user-provided key ---
router.post('/restore', async (req, res) => {
    const { key } = req.body;
    if (!key) return res.status(400).json({ message: "Encryption key is required" });

    try {
        const backupDir = path.join(__dirname, '../backups');
        const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.enc'));
        if (files.length === 0) return res.status(404).json({ message: "No backups found" });

        const latestFile = files.sort().reverse()[0];
        const backupPath = path.join(backupDir, latestFile);
        const encryptedData = fs.readFileSync(backupPath, 'utf-8');

        // Decrypt backup with user-provided key
        const decryptedData = decryptWithKey(encryptedData, key);
        const { users: backupUsers, transactions: backupTransactions } = JSON.parse(decryptedData);

        // --- Merge users ---
        for (const u of backupUsers) {
            const exists = await User.findOne({ email: u.email });
            if (!exists) await User.create(u);
        }

        // --- Merge transactions safely ---
        for (const t of backupTransactions) {
            // Map fields to match schema
            const transactionData = {
                type: t.type || 'Cash',
                mode: t.mode || 'Credit',
                from: t.from || t.fromWhom || 'Unknown',
                amount: t.amount || 0,
                date: t.date || new Date()
            };
            const exists = await Transaction.findOne({
                type: transactionData.type,
                mode: transactionData.mode,
                from: transactionData.from,
                amount: transactionData.amount,
                date: transactionData.date
            });
            if (!exists) await Transaction.create(transactionData);
        }

        res.json({ success: true, message: `Backup merged from ${latestFile}` });
    } catch (err) {
        console.error('Error restoring backup:', err);
        res.status(500).json({ message: "Error restoring backup", error: err.message });
    }
});

module.exports = router;
