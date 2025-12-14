// Quick test untuk verify database connection
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    user: process.env.DB_USER || 'sinfomik_user',
    password: process.env.DB_PASSWORD || 'sinfomik123',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sinfomik',
});

async function test() {
    try {
        // Test 1: Simple SELECT
        console.log('Test 1: Simple SELECT...');
        const result1 = await pool.query('SELECT COUNT(*) FROM tahunajaransemester');
        console.log('✓ tahunajaransemester count:', result1.rows[0].count);

        // Test 2: INSERT without RETURNING
        console.log('\nTest 2: INSERT without RETURNING...');
        const result2 = await pool.query(
            'INSERT INTO tahunajaransemester (tahun_ajaran, semester) VALUES ($1, $2)',
            ['2017/2018', 'Ganjil']
        );
        console.log('✓ Inserted rows:', result2.rowCount);

        // Test 3: INSERT with RETURNING
        console.log('\nTest 3: INSERT with RETURNING...');
        const result3 = await pool.query(
            'INSERT INTO tahunajaransemester (tahun_ajaran, semester) VALUES ($1, $2) RETURNING id_ta_semester',
            ['2016/2017', 'Ganjil']
        );
        console.log('✓ ID returned:', result3.rows[0].id_ta_semester);

        // Test 4: Check if placeholder conversion works
        console.log('\nTest 4: Placeholder conversion ?->$1...');
        const sql = 'INSERT INTO kelas (nama_kelas, id_ta_semester) VALUES (?, ?)';
        const converted = sql.replace(/\?/g, (match, offset) => {
            const paramIndex = (sql.substring(0, offset).match(/\?/g) || []).length + 1;
            return `$${paramIndex}`;
        });
        console.log('Original:', sql);
        console.log('Converted:', converted);

        console.log('\n✅ All tests passed!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err);
        process.exit(1);
    }
}

test();
