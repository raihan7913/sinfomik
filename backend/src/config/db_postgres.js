// backend/src/config/db_postgres.js
// PostgreSQL Database Configuration
// Replace db.js dengan file ini setelah migrasi

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

let pool;

function initializePool() {
    const config = {
        user: process.env.DB_USER || 'sinfomik_user',
        password: process.env.DB_PASSWORD || 'sinfomik123',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
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
        console.log('New client connected to PostgreSQL');
    });

    return pool;
}

// Initialize pool when module loads
const dbPool = initializePool();

// Convert SQLite placeholders (?) to PostgreSQL placeholders ($1, $2, etc.)
function convertPlaceholders(sql) {
    let paramIndex = 1;
    return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

// Convert table names from CamelCase to lowercase for PostgreSQL compatibility
function normalizeTableNames(sql) {
    // Map of PascalCase table names to lowercase
    const tableMap = {
        'TahunAjaranSemester': 'tahunajaransemester',
        'Kelas': 'kelas',
        'Guru': 'guru',
        'Siswa': 'siswa',
        'MataPelajaran': 'matapelajaran',
        'TipeNilai': 'tipenilai',
        'Nilai': 'nilai',
        'SiswaKelas': 'siswakelas',
        'GuruMataPelajaran': 'gurumatapelajaran',
        'GuruMataPelajaranKelas': 'gurumatapelajarankelas',
        'SiswaCapaianPembelajaran': 'siswacapaianpembelajaran',
        'CapaianPembelajaran': 'capaianpembelajaran',
        'KKM_Settings': 'kkm_settings',
        'DetailNilaiTugas': 'detailnilaitugas',
        'manual_tp': 'manual_tp',
    };
    
    let result = sql;
    for (const [camelCase, lowercase] of Object.entries(tableMap)) {
        // Replace table names while preserving case in aliases and column names
        // Use word boundary regex to avoid partial matches
        const regex = new RegExp(`\\b${camelCase}\\b`, 'g');
        result = result.replace(regex, lowercase);
    }
    return result;
}

// Extract primary key column name from table name
function getPrimaryKeyColumn(sql) {
    // Map table names to their primary key columns
    const pkMap = {
        'TahunAjaranSemester': 'id_ta_semester',
        'tahunajaran': 'id_ta_semester',
        'tahunajaransemester': 'id_ta_semester',
        'Kelas': 'id_kelas',
        'kelas': 'id_kelas',
        'Guru': 'id_guru',
        'guru': 'id_guru',
        'Siswa': 'id_siswa',
        'siswa': 'id_siswa',
        'MataPelajaran': 'id_mapel',
        'matapelajaran': 'id_mapel',
        'SiswaKapasian': 'id_siswa_kapasian',
        'siswakapasian': 'id_siswa_kapasian',
        'SiswaKelas': 'id_siswa_kelas',
        'siswakelas': 'id_siswa_kelas',
        'GuruMataPelajaran': 'id_guru_mapel',
        'gurumatapalajaran': 'id_guru_mapel',
        'GuruMataPelajaranKelas': 'id_guru_mapel_kelas',
        'gurumatapelajarankelas': 'id_guru_mapel_kelas',
        'Nilai': 'id_nilai',
        'nilai': 'id_nilai',
        'TipeNilai': 'id_tipe_nilai',
        'tipetnilai': 'id_tipe_nilai',
        'KKM_Settings': 'id_kkm_setting',
        'kkmsettings': 'id_kkm_setting',
        'manual_tp': 'id_manual_tp',
    };
    
    const upperSql = sql.toUpperCase();
    
    // Try to extract table name from INSERT INTO statement
    const insertMatch = upperSql.match(/INSERT\s+INTO\s+([A-Za-z_0-9]+)/i);
    if (insertMatch) {
        const tableName = insertMatch[1];
        // Try case-sensitive match first, then case-insensitive
        if (pkMap[tableName]) return pkMap[tableName];
        if (pkMap[tableName.toLowerCase()]) return pkMap[tableName.toLowerCase()];
    }
    
    // Fallback: check all known table names in SQL
    for (const [tableName, pkCol] of Object.entries(pkMap)) {
        const upperTable = tableName.toUpperCase();
        if (upperSql.includes(`INTO ${upperTable}`) || upperSql.includes(`INSERT INTO ${upperTable}`)) {
            return pkCol;
        }
    }
    return 'id'; // Default fallback
}

// Auto-add RETURNING clause for INSERT statements if not already present
function ensureReturning(sql) {
    const trimmedUpper = sql.trim().toUpperCase();
    
    // Only process INSERT statements
    if (!trimmedUpper.startsWith('INSERT')) {
        return sql;
    }
    
    // If already has RETURNING, don't modify
    if (trimmedUpper.includes('RETURNING')) {
        return sql;
    }
    
    // Extract table name and add appropriate RETURNING clause
    let returningClause = null;
    
    if (trimmedUpper.includes('TAHUNAJARANSEMESTER') || trimmedUpper.includes('TAHUN_AJARAN_SEMESTER')) {
        returningClause = 'RETURNING id_ta_semester';
    } else if (trimmedUpper.includes('KELAS')) {
        returningClause = 'RETURNING id_kelas';
    } else if (trimmedUpper.includes('GURU')) {
        returningClause = 'RETURNING id_guru';
    } else if (trimmedUpper.includes('SISWA')) {
        returningClause = 'RETURNING id_siswa';
    } else if (trimmedUpper.includes('MATAPELAJARAN')) {
        returningClause = 'RETURNING id_mapel';
    } else if (trimmedUpper.includes('NILAI')) {
        returningClause = 'RETURNING id_nilai';
    } else if (trimmedUpper.includes('TIPETNILAI')) {
        returningClause = 'RETURNING id_tipe_nilai';
    }
    
    if (returningClause) {
        // Remove trailing semicolon if exists and add RETURNING
        const cleanSql = sql.replace(/;?\s*$/, '');
        return cleanSql + ' ' + returningClause;
    }
    
    return sql;
}

// Wrapper untuk kompatibilitas dengan old callback-based code
// Gradual migration dari SQLite callback style ke async/await
class DatabaseAdapter {
    run(sql, params = [], callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        let convertedSql = convertPlaceholders(sql);
        // Add RETURNING clause for INSERT statements
        convertedSql = ensureReturning(convertedSql);
        
        dbPool.query(convertedSql, params, (err, result) => {
            if (err) {
                if (callback) callback(err);
                return;
            }
            
            // Get the primary key column name for lastID extraction
            const pkCol = getPrimaryKeyColumn(sql);
            const lastID = result.rows[0]?.[pkCol] || null;
            
            // Create a context object with lastID and changes properties
            const context = {
                lastID: lastID,
                changes: result.rowCount 
            };
            
            // Call the callback with the context object as 'this'
            if (callback) callback.call(context, null);
        });
    }

    get(sql, params = [], callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        let convertedSql = convertPlaceholders(sql);
        
        dbPool.query(convertedSql, params, (err, result) => {
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

        let convertedSql = convertPlaceholders(sql);
        
        dbPool.query(convertedSql, params, (err, result) => {
            if (err) {
                if (callback) callback(err);
                return;
            }
            if (callback) callback(null, result.rows);
        });
    }

    // Async/await style (preferred)
    async queryAsync(sql, params = []) {
        try {
            const convertedSql = convertPlaceholders(sql);
            const result = await dbPool.query(convertedSql, params);
            return result.rows;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    async getAsync(sql, params = []) {
        try {
            const convertedSql = convertPlaceholders(sql);
            const result = await dbPool.query(convertedSql, params);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    async runAsync(sql, params = []) {
        try {
            let convertedSql = convertPlaceholders(sql);
            convertedSql = ensureReturning(convertedSql);
            const result = await dbPool.query(convertedSql, params);
            
            const pkCol = getPrimaryKeyColumn(sql);
            const lastID = result.rows[0]?.[pkCol] || null;
            
            return {
                lastID: lastID,
                changes: result.rowCount
            };
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
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
