// Simple script untuk remove password_hash column dari Siswa table
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../../backend/academic_dashboard.db');

console.log('📁 Database path:', DB_PATH);

if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Database file not found!');
    process.exit(1);
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Connection error:', err);
        process.exit(1);
    }
    
    console.log('✅ Connected to database');
    
    // Check current schema
    db.all("PRAGMA table_info(Siswa)", (err, cols) => {
        if (err) {
            console.error('❌ Error checking schema:', err);
            db.close();
            process.exit(1);
        }
        
        console.log('\n📋 Current Siswa columns:');
        cols.forEach(c => console.log('  -', c.name, `(${c.type})`));
        
        const hasPassword = cols.some(c => c.name === 'password_hash');
        
        if (!hasPassword) {
            console.log('\n✅ Column password_hash already removed!');
            db.close();
            process.exit(0);
        }
        
        console.log('\n🔧 Removing password_hash column...\n');
        
        // Start transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                    console.error('❌ Error starting transaction:', err);
                    db.close();
                    process.exit(1);
                }
                
                // Step 1: Create temp table
                db.run(`
                    CREATE TABLE Siswa_temp (
                        id_siswa INTEGER PRIMARY KEY,
                        nama_siswa TEXT NOT NULL,
                        tanggal_lahir TEXT,
                        jenis_kelamin TEXT,
                        tahun_ajaran_masuk TEXT
                    )
                `, (err) => {
                    if (err) {
                        console.error('❌ Error creating temp table:', err);
                        db.run('ROLLBACK');
                        db.close();
                        process.exit(1);
                    }
                    console.log('  ✓ Created Siswa_temp table');
                    
                    // Step 2: Copy data
                    db.run(`
                        INSERT INTO Siswa_temp
                        SELECT id_siswa, nama_siswa, tanggal_lahir, jenis_kelamin, tahun_ajaran_masuk
                        FROM Siswa
                    `, function(err) {
                        if (err) {
                            console.error('❌ Error copying data:', err);
                            db.run('ROLLBACK');
                            db.close();
                            process.exit(1);
                        }
                        console.log('  ✓ Copied', this.changes, 'rows to temp table');
                        
                        // Step 3: Drop old table
                        db.run('DROP TABLE Siswa', (err) => {
                            if (err) {
                                console.error('❌ Error dropping table:', err);
                                db.run('ROLLBACK');
                                db.close();
                                process.exit(1);
                            }
                            console.log('  ✓ Dropped old Siswa table');
                            
                            // Step 4: Rename temp to original
                            db.run('ALTER TABLE Siswa_temp RENAME TO Siswa', (err) => {
                                if (err) {
                                    console.error('❌ Error renaming table:', err);
                                    db.run('ROLLBACK');
                                    db.close();
                                    process.exit(1);
                                }
                                console.log('  ✓ Renamed temp table to Siswa');
                                
                                // Step 5: Commit
                                db.run('COMMIT', (err) => {
                                    if (err) {
                                        console.error('❌ Error committing:', err);
                                        db.close();
                                        process.exit(1);
                                    }
                                    
                                    console.log('\n✅ Successfully removed password_hash column!');
                                    
                                    // Verify
                                    db.all("PRAGMA table_info(Siswa)", (err, cols) => {
                                        if (!err) {
                                            console.log('\n📋 New Siswa columns:');
                                            cols.forEach(c => console.log('  -', c.name, `(${c.type})`));
                                        }
                                        db.close();
                                        process.exit(0);
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
