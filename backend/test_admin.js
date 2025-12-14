// Quick test untuk cek data admin
const { getDb } = require('./config/db');

const db = getDb();

db.get("SELECT * FROM admin WHERE username = ?", ['admin'], (err, row) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('Admin data:', row);
    }
    process.exit(0);
});