// backend/src/config/db.js
// PostgreSQL Database Configuration
// Migrated from SQLite to PostgreSQL

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Environment variables are loaded by server.js before this module is required

let pool;

function initializePool() {
    console.log('🔍 DB Config:', {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD ? '***' : 'undefined',
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
    });

    const config = {
        user: process.env.DB_USER || 'sinfomik_user',
        password: process.env.DB_PASSWORD || 'sinfomik123',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'sinfomik',
        // Connection pool settings
        max: parseInt(process.env.DB_POOL_MAX) || 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };

    pool = new Pool(config);

    pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
    });

    pool.on('connect', () => {
        console.log('✅ New client connected to PostgreSQL');
    });

    return pool;
}

// Initialize pool when module loads
const dbPool = initializePool();

// Wrapper untuk kompatibilitas dengan old callback-based code
class DatabaseAdapter {
    // Helper: convert ? placeholders to $1, $2, etc for PostgreSQL
    _convertPlaceholders(sql) {
        let counter = 0;
        return sql.replace(/\?/g, () => {
            counter++;
            return `$${counter}`;
        });
    }

    _executeQuery(normalizedSql, params, callback) {
        params = params || [];
        if (this._serialClient) {
            if (!this._serialPending) this._serialPending = 0;
            this._serialPending++;
            this._serialClient.query(normalizedSql, params, (err, result) => {
                this._serialPending--;
                if (err && err.code === '23505') err.message = err.message + ' (UNIQUE constraint failed)';
                if (err) this._serialError = err;
                callback && callback(err, result);
            });
        } else {
            dbPool.query(normalizedSql, params, (err, result) => {
                if (err && err.code === '23505') err.message = err.message + ' (UNIQUE constraint failed)';
                callback && callback(err, result);
            });
        }
    }

    run(sql, params = [], callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        sql = this._convertPlaceholders(sql);
        // If it's an INSERT and doesn't already contain RETURNING, append RETURNING *
        const normalizedSql = /INSERT\s+/i.test(sql) && !/RETURNING\s+/i.test(sql)
            ? `${sql} RETURNING *`
            : sql;

        const handleResult = (err, result) => {
            if (err) {
                // Normalize Postgres UNIQUE constraint error to sqlite-like message for compatibility with legacy code
                if (err && err.code === '23505') {
                    err.message = err.message + ' (UNIQUE constraint failed)';
                }
                if (callback) callback(err);
                return;
            }
            // Provide sqlite-like 'this' context for legacy code
            // If INSERT RETURNING * present, try to detect a numeric id column
            let lastID = null;
            if (result && result.rows && result.rows[0]) {
                const row = result.rows[0];
                // Look for a key that looks like an id (id, id_*, *_id) and numeric value
                const keys = Object.keys(row);
                for (const k of keys) {
                    const val = row[k];
                    if (val === null || val === undefined) continue;
                    if (/^id($|_|[A-Z])/.test(k) || /(^id_|_id$)/.test(k) || k === 'id') {
                        if (typeof val === 'number' || !isNaN(parseInt(val))) {
                            lastID = val;
                            break;
                        }
                    }
                }
            }
            const changes = result && result.rowCount ? result.rowCount : 0;
            if (callback) {
                callback.call({ lastID, changes }, null, result && result.rows ? result.rows : []);
            }
        };

        this._executeQuery(normalizedSql, params, handleResult);
    }

    get(sql, params = [], callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        sql = this._convertPlaceholders(sql);
        const normalizedSql = sql;
        this._executeQuery(normalizedSql, params, (err, result) => {
            if (err) {
                if (callback) callback(err);
                return;
            }
            if (callback) callback(null, result.rows[0]);
        });
    }

    all(sql, params = [], callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        sql = this._convertPlaceholders(sql);
        const normalizedSql = sql;
        this._executeQuery(normalizedSql, params, (err, result) => {
            if (err) {
                if (callback) callback(err);
                return;
            }
            if (callback) callback(null, result.rows);
        });
    }

    exec(sql, callback) {
        // For exec (multiple statements), execute statements sequentially.
        // We split by semicolon and run each statement; we don't support params here.
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        const runNext = (i) => {
            if (i >= statements.length) {
                if (callback) callback(null);
                return;
            }
            const stmt = statements[i];
            const normalizedSql = this._convertPlaceholders(stmt);
            const clientQuery = this._serialClient ? this._serialClient.query(normalizedSql) : dbPool.query(normalizedSql);
            // Use promise-based handling
            if (clientQuery && clientQuery.then) {
                clientQuery.then(() => runNext(i + 1)).catch((err) => {
                    if (err && err.code === '23505') err.message = err.message + ' (UNIQUE constraint failed)';
                    if (callback) callback(err);
                });
            } else {
                // Fallback: if callback-style (rare)
                dbPool.query(normalizedSql, [], (err) => {
                    if (err) {
                        if (err && err.code === '23505') err.message = err.message + ' (UNIQUE constraint failed)';
                        if (callback) callback(err);
                        return;
                    }
                    runNext(i + 1);
                });
            }
        };
        runNext(0);
    }

    // Async/await style
    async queryAsync(sql, params = []) {
        try {
            sql = this._convertPlaceholders(sql);
            const normalizedSql = this._convertPlaceholders(sql);
            const result = this._serialClient ? await this._serialClient.query(normalizedSql, params) : await dbPool.query(normalizedSql, params);
            return result.rows;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    async getAsync(sql, params = []) {
        try {
            sql = this._convertPlaceholders(sql);
            const normalizedSql = this._convertPlaceholders(sql);
            const result = this._serialClient ? await this._serialClient.query(normalizedSql, params) : await dbPool.query(normalizedSql, params);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    async runAsync(sql, params = []) {
        try {
            const normalizedSql = this._convertPlaceholders(sql);
            // If it's an INSERT without RETURNING, append RETURNING *
            const finalSql = /INSERT\s+/i.test(normalizedSql) && !/RETURNING\s+/i.test(normalizedSql) ? `${normalizedSql} RETURNING *` : normalizedSql;
            const result = this._serialClient ? await this._serialClient.query(finalSql, params) : await dbPool.query(finalSql, params);
            let lastID = null;
            if (result && result.rows && result.rows[0]) {
                const row = result.rows[0];
                const keys = Object.keys(row);
                for (const k of keys) {
                    const val = row[k];
                    if (val === null || val === undefined) continue;
                    if (/^id($|_|[A-Z])/.test(k) || /(^id_|_id$)/.test(k) || k === 'id') {
                        if (typeof val === 'number' || !isNaN(parseInt(val))) {
                            lastID = val;
                            break;
                        }
                    }
                }
            }
            return {
                lastID,
                changes: result.rowCount
            };
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    // Serialize - run a series of statements on the same client (transaction)
    serialize(cb) {
        // Acquire client
        dbPool.connect().then((client) => {
            this._serialClient = client;
            this._serialPending = 0;
            client.query('BEGIN').then(() => {
                try {
                    cb();
                } catch (err) {
                    console.error('[db.serialize] callback error', err);
                }
                // wait until pending queries finished
                const check = () => {
                            if (!this._serialPending || this._serialPending === 0) {
                                if (this._serialError) {
                                    client.query('ROLLBACK').finally(() => {
                                        this._serialClient = null;
                                        this._serialError = null;
                                        client.release();
                                    });
                                } else {
                                    client.query('COMMIT').finally(() => {
                                        this._serialClient = null;
                                        client.release();
                                    });
                                }
                    } else {
                        setTimeout(check, 25);
                    }
                };
                check();
            }).catch((err) => {
                console.error('[db.serialize] begin transaction error', err);
                this._serialClient = null;
                client.release();
            });
        }).catch((err) => {
            console.error('[db.serialize] pool connect error', err);
            cb();
        });
    }
}

const adapter = new DatabaseAdapter();

function getDb() {
    return adapter;
}

function getPool() {
    return dbPool;
}

// Graceful shutdown
process.on('exit', () => {
    dbPool.end(() => {
        console.log('PostgreSQL connection pool closed');
    });
});

module.exports = { getDb, getPool, adapter };
