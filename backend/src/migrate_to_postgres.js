// backend/src/migrate_to_postgres.js
// Script untuk migrate data dari SQLite ke PostgreSQL

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// SQLite connection (optional - only used if a SQLite file is present)
const sqliteDbPath = process.env.DB_PATH || path.resolve(__dirname, '../academic_dashboard.db');
let sqliteDb = null;
let sqlite3 = null;
if (fs.existsSync(sqliteDbPath)) {
    // Require sqlite3 lazily only when the file exists
    sqlite3 = require('sqlite3').verbose();
    sqliteDb = new sqlite3.Database(sqliteDbPath);
} else {
    console.warn(`⚠️  SQLite file not found at ${sqliteDbPath}. Migration will not run without a SQLite DB.`);
}

// PostgreSQL connection
const pgPool = new Pool({
    user: process.env.DB_USER || 'sinfomik_user',
    password: process.env.DB_PASSWORD || 'sinfomik',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sinfomik',
});

let migratedCount = 0;
let errorCount = 0;

async function migrateData() {
    try {
        if (!sqliteDb) {
            throw new Error(`SQLite database not found. Set DB_PATH or place the SQLite file at ${sqliteDbPath}`);
        }

        console.log('🔄 Starting data migration from SQLite to PostgreSQL...\n');

        // Disable foreign key checks sementara untuk fleksibilitas
        await pgPool.query('SET CONSTRAINTS ALL DEFERRED');

        // Get all tables dari SQLite
        const tables = await new Promise((resolve, reject) => {
            sqliteDb.all(
                `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(r => r.name));
                }
            );
        });

        console.log(`📋 Found ${tables.length} tables to migrate:\n`);

        // Migrate setiap table
        for (const table of tables) {
            console.log(`⏳ Migrating ${table}...`);
            await migrateTable(table);
            console.log(`✅ ${table} migrated\n`);
        }

        console.log('\n' + '='.repeat(50));
        console.log(`🎉 Migration Complete!`);
        console.log(`📊 Total records migrated: ${migratedCount}`);
        console.log(`❌ Total errors: ${errorCount}`);
        console.log('='.repeat(50) + '\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        sqliteDb.close();
        await pgPool.end();
    }
}

async function migrateTable(tableName) {
    try {
        // Get all data from SQLite
        const rows = await new Promise((resolve, reject) => {
            sqliteDb.all(`SELECT * FROM ${tableName}`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        if (rows.length === 0) {
            console.log(`  ℹ️  (Empty table)`);
            return;
        }

        // Get columns
        const columns = Object.keys(rows[0]);

        // Insert ke PostgreSQL
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const values = columns.map((col, idx) => {
                const value = row[col];
                
                // Handle NULL values
                if (value === null || value === undefined) {
                    return null;
                }

                // Handle BOOLEAN (SQLite = 0/1, PostgreSQL = boolean)
                if (typeof value === 'boolean' || (typeof value === 'number' && col.includes('is_'))) {
                    return value ? true : false;
                }

                return value;
            });

            const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(',');
            const query = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;

            try {
                await pgPool.query(query, values);
                migratedCount++;

                // Progress indicator
                if ((i + 1) % 100 === 0) {
                    process.stdout.write(`  Processed ${i + 1}/${rows.length} rows...\r`);
                }
            } catch (insertError) {
                // Log error tapi continue
                console.error(`  ❌ Error inserting row ${i + 1} into ${tableName}:`, insertError.message);
                errorCount++;
            }
        }

        console.log(`  ✓ Migrated ${rows.length} rows`);

    } catch (error) {
        console.error(`Error migrating ${tableName}:`, error);
        errorCount++;
    }
}

// Run migration
if (require.main === module) {
    migrateData().catch(console.error);
}

module.exports = migrateData;
