const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
console.log('Reading .env from:', envPath);

try {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    console.log('Found keys in .env:');
    Object.keys(envConfig).forEach(key => {
        console.log(`- ${key}`);
    });
} catch (e) {
    console.error('Error reading .env:', e.message);
}
