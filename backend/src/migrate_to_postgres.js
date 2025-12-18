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
    console.log(`SQLite file found at: ${sqliteDbPath}`);
} else {
    console.warn(`⚠️  SQLite file not found at ${sqliteDbPath}. Migration will not run without a SQLite DB.`);
}

// PostgreSQL connection
const pgPool = new Pool({
    user: process.env.DB_USER || 'sinfomik_user',
    password: process.env.DB_PASSWORD || 'sinfomik123',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sinfomik',
});

// Safety: Prevent accidental runs against remote hosts.
// To intentionally run against a remote host set ALLOW_REMOTE_MIGRATE=true and pass --allow-remote.
const pgHost = process.env.DB_HOST || 'localhost';
const isLocalHost = /^(localhost|127\.0\.0\.1|::1)$/.test(pgHost);
const allowRemoteFlag = process.argv.includes('--allow-remote');
// Accept common truthy values for the env flag (true, 1, yes)
const allowRemoteEnv = /^\s*(true|1|yes)\s*$/i.test(process.env.ALLOW_REMOTE_MIGRATE || '');
if (!isLocalHost && !(allowRemoteFlag && allowRemoteEnv)) {
    console.error(`Refusing to run migration against remote host '${pgHost}'.`);
    console.error('If you really intend to migrate against a remote host, set ALLOW_REMOTE_MIGRATE=true (or 1) and pass --allow-remote.');
    process.exit(2);
}

// migration behavior flags
const doTruncate = process.argv.includes('--truncate');
const doUpsert = process.argv.includes('--upsert');
const doSkipExisting = process.argv.includes('--skip-existing');

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

        // Get all tables dari SQLite and determine dependency order
        const sqliteTables = await new Promise((resolve, reject) => {
            sqliteDb.all(
                `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(r => r.name));
                }
            );
        });

        // Build dependency graph via PRAGMA foreign_key_list
        const deps = {};
        for (const t of sqliteTables) {
            deps[t] = new Set();
            const fkRows = await new Promise((resolve, reject) => {
                sqliteDb.all(`PRAGMA foreign_key_list(${t})`, (err, rows) => {
                    if (err) return resolve([]); // tables without FK will error here on some sqlite versions
                    resolve(rows || []);
                });
            });
            for (const fk of fkRows) {
                if (fk && fk.table) deps[t].add(fk.table);
            }
        }

        // Topological sort (Kahn's algorithm) using lowercase comparison
        const lower = name => String(name).toLowerCase();
        const allNodes = sqliteTables.slice();
        const incoming = {};
        for (const n of allNodes) incoming[n] = 0;
        for (const n of allNodes) {
            for (const m of deps[n]) {
                // Only consider dependencies that exist in the list
                if (allNodes.find(x => lower(x) === lower(m))) incoming[n]++;
            }
        }
        const queue = allNodes.filter(n => incoming[n] === 0);
        const ordered = [];
        while (queue.length) {
            const n = queue.shift();
            ordered.push(n);
            for (const m of allNodes) {
                if (deps[m].has(n)) {
                    incoming[m]--;
                    if (incoming[m] === 0) queue.push(m);
                }
            }
        }

        const tables = ordered.length === allNodes.length ? ordered : sqliteTables;
        console.log(`📋 Found ${tables.length} tables to migrate (order:${tables.join(', ')}):\n`);

        // Migrate setiap table in dependency order
        for (const table of tables) {
            console.log(`⏳ Migrating ${table}...`);
            await migrateTable(table);
            console.log(`✅ ${table} migrated\n`);
        }

        // After data migration, adjust serial sequences where applicable
        console.log('🔧 Adjusting sequences...');
        for (const table of tables) {
            try {
                const seqRes = await pgPool.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [table.toLowerCase()]);
                const seq = seqRes.rows && seqRes.rows[0] && seqRes.rows[0].seq;
                if (seq) {
                    await pgPool.query(`SELECT setval($1, COALESCE((SELECT MAX(id) FROM ${table.toLowerCase()}), 1), true)`, [seq]);
                    console.log(`  • Sequence for ${table} set`);
                }
            } catch (e) {
                // Ignore sequence problems and continue
            }
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
        const targetTable = tableName.toLowerCase();
        // Optionally truncate the target table before inserting
        if (doTruncate) {
            console.log(`  ⚠️  Truncating ${targetTable} (RESTART IDENTITY, CASCADE)`);
            await pgPool.query(`TRUNCATE TABLE ${targetTable} RESTART IDENTITY CASCADE`);
        }
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

        // Determine primary key column in target if possible
        let pkColumn = null;
        try {
            const pkRes = await pgPool.query(
                `SELECT a.attname AS column
                 FROM pg_index i
                 JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                 WHERE i.indrelid = $1::regclass AND i.indisprimary`,
                [targetTable]
            );
            if (pkRes.rows && pkRes.rows[0]) pkColumn = pkRes.rows[0].column;
        } catch (e) {
            // ignore if table doesn't exist or cannot detect
        }

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
            // Build INSERT / UPSERT variants depending on flags
            let query, params = values;
            if (doUpsert) {
                if (pkColumn && columns.includes(pkColumn)) {
                    const updates = columns.filter(c => c !== pkColumn).map(c => `${c}=EXCLUDED.${c}`).join(',');
                    query = `INSERT INTO ${targetTable} (${columns.join(',')}) VALUES (${placeholders}) ON CONFLICT (${pkColumn}) DO UPDATE SET ${updates}`;
                } else {
                    // fallback to do-nothing on conflict
                    query = `INSERT INTO ${targetTable} (${columns.join(',')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
                }
            } else if (doSkipExisting) {
                query = `INSERT INTO ${targetTable} (${columns.join(',')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
            } else {
                query = `INSERT INTO ${targetTable} (${columns.join(',')}) VALUES (${placeholders})`;
            }

            try {
                await pgPool.query(query, params);
                migratedCount++;

                // Progress indicator
                if ((i + 1) % 100 === 0) {
                    process.stdout.write(`  Processed ${i + 1}/${rows.length} rows...\r`);
                }
            } catch (insertError) {
                 // Log error tapi continue — include row preview for debugging
                 const preview = JSON.stringify(row, Object.keys(row).slice(0, 10));
                 console.error(`  ❌ Error inserting row ${i + 1} into ${tableName}: ${insertError.message}`);
                 console.error(`     row preview: ${preview}`);
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
