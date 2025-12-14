// backend/src/init_db_postgres_simple.js
// Simplified PostgreSQL initialization with better error handling

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
});

const createTablesSQL = [
    `CREATE TABLE IF NOT EXISTS Admin (
        id_admin SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        nama TEXT NOT NULL,
        last_login_timestamp BIGINT
    );`,
    
    `CREATE TABLE IF NOT EXISTS Guru (
        id_guru TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        nama_guru TEXT NOT NULL,
        email TEXT UNIQUE,
        last_login_timestamp BIGINT
    );`,
    
    `CREATE TABLE IF NOT EXISTS Siswa (
        id_siswa INTEGER PRIMARY KEY,
        nama_siswa TEXT NOT NULL,
        tanggal_lahir TEXT,
        jenis_kelamin TEXT,
        tahun_ajaran_masuk TEXT
    );`,
    
    `CREATE TABLE IF NOT EXISTS TahunAjaranSemester (
        id_ta_semester SERIAL PRIMARY KEY,
        tahun_ajaran TEXT NOT NULL,
        semester TEXT NOT NULL,
        is_aktif BOOLEAN DEFAULT FALSE,
        UNIQUE(tahun_ajaran, semester)
    );`,
    
    `CREATE TABLE IF NOT EXISTS Kelas (
        id_kelas SERIAL PRIMARY KEY,
        nama_kelas TEXT NOT NULL,
        id_wali_kelas TEXT,
        id_ta_semester INTEGER NOT NULL,
        FOREIGN KEY (id_wali_kelas) REFERENCES Guru(id_guru),
        FOREIGN KEY (id_ta_semester) REFERENCES TahunAjaranSemester(id_ta_semester),
        UNIQUE(nama_kelas, id_ta_semester)
    );`,
    
    `CREATE TABLE IF NOT EXISTS MataPelajaran (
        id_mapel SERIAL PRIMARY KEY,
        nama_mapel TEXT NOT NULL UNIQUE
    );`,
    
    `CREATE TABLE IF NOT EXISTS TipeNilai (
        id_tipe_nilai SERIAL PRIMARY KEY,
        nama_tipe TEXT NOT NULL UNIQUE,
        deskripsi TEXT
    );`,
    
    `CREATE TABLE IF NOT EXISTS SiswaKelas (
        id_siswa_kelas SERIAL PRIMARY KEY,
        id_siswa INTEGER NOT NULL,
        id_kelas INTEGER NOT NULL,
        id_ta_semester INTEGER NOT NULL,
        FOREIGN KEY (id_siswa) REFERENCES Siswa(id_siswa),
        FOREIGN KEY (id_kelas) REFERENCES Kelas(id_kelas),
        FOREIGN KEY (id_ta_semester) REFERENCES TahunAjaranSemester(id_ta_semester),
        UNIQUE(id_siswa, id_kelas, id_ta_semester)
    );`,
    
    `CREATE TABLE IF NOT EXISTS GuruMataPelajaranKelas (
        id_guru_mapel_kelas SERIAL PRIMARY KEY,
        id_guru TEXT NOT NULL,
        id_mapel INTEGER NOT NULL,
        id_kelas INTEGER NOT NULL,
        id_ta_semester INTEGER NOT NULL,
        FOREIGN KEY (id_guru) REFERENCES Guru(id_guru),
        FOREIGN KEY (id_mapel) REFERENCES MataPelajaran(id_mapel),
        FOREIGN KEY (id_kelas) REFERENCES Kelas(id_kelas),
        FOREIGN KEY (id_ta_semester) REFERENCES TahunAjaranSemester(id_ta_semester),
        UNIQUE(id_guru, id_mapel, id_kelas, id_ta_semester)
    );`,
    
    `CREATE TABLE IF NOT EXISTS Nilai (
        id_nilai SERIAL PRIMARY KEY,
        id_siswa INTEGER NOT NULL,
        id_guru TEXT NOT NULL,
        id_mapel INTEGER NOT NULL,
        id_kelas INTEGER NOT NULL,
        id_ta_semester INTEGER NOT NULL,
        jenis_nilai TEXT NOT NULL CHECK (jenis_nilai IN ('TP', 'UAS')),
        urutan_tp INTEGER,
        nilai REAL NOT NULL,
        tanggal_input TEXT NOT NULL,
        keterangan TEXT,
        FOREIGN KEY (id_siswa) REFERENCES Siswa(id_siswa),
        FOREIGN KEY (id_guru) REFERENCES Guru(id_guru),
        FOREIGN KEY (id_mapel) REFERENCES MataPelajaran(id_mapel),
        FOREIGN KEY (id_kelas) REFERENCES Kelas(id_kelas),
        FOREIGN KEY (id_ta_semester) REFERENCES TahunAjaranSemester(id_ta_semester),
        UNIQUE(id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp)
    );`,
    
    `CREATE TABLE IF NOT EXISTS CapaianPembelajaran (
        id_cp SERIAL PRIMARY KEY,
        id_mapel INTEGER NOT NULL,
        fase TEXT,
        deskripsi_cp TEXT NOT NULL,
        file_path TEXT,
        FOREIGN KEY (id_mapel) REFERENCES MataPelajaran(id_mapel),
        UNIQUE(id_mapel, fase)
    );`,
    
    `CREATE TABLE IF NOT EXISTS SiswaCapaianPembelajaran (
        id_siswa_cp SERIAL PRIMARY KEY,
        id_siswa INTEGER NOT NULL,
        id_cp INTEGER NOT NULL,
        id_guru TEXT NOT NULL,
        id_ta_semester INTEGER NOT NULL,
        status_capaian TEXT NOT NULL,
        tanggal_penilaian TEXT NOT NULL,
        catatan TEXT,
        FOREIGN KEY (id_siswa) REFERENCES Siswa(id_siswa),
        FOREIGN KEY (id_cp) REFERENCES CapaianPembelajaran(id_cp),
        FOREIGN KEY (id_guru) REFERENCES Guru(id_guru),
        FOREIGN KEY (id_ta_semester) REFERENCES TahunAjaranSemester(id_ta_semester),
        UNIQUE(id_siswa, id_cp, id_ta_semester)
    );`,
    
    `CREATE TABLE IF NOT EXISTS KKM_Settings (
        id_kkm SERIAL PRIMARY KEY,
        id_guru TEXT NOT NULL,
        id_mapel INTEGER NOT NULL,
        id_kelas INTEGER NOT NULL,
        id_ta_semester INTEGER NOT NULL,
        jenis_nilai TEXT NOT NULL CHECK (jenis_nilai IN ('TP', 'UAS', 'FINAL')),
        urutan_tp INTEGER,
        nilai_kkm REAL NOT NULL,
        tanggal_update TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_guru) REFERENCES Guru(id_guru),
        FOREIGN KEY (id_mapel) REFERENCES MataPelajaran(id_mapel),
        FOREIGN KEY (id_kelas) REFERENCES Kelas(id_kelas),
        FOREIGN KEY (id_ta_semester) REFERENCES TahunAjaranSemester(id_ta_semester),
        UNIQUE(id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp)
    );`,
    
    `CREATE TABLE IF NOT EXISTS manual_tp (
        id_manual_tp SERIAL PRIMARY KEY,
        id_penugasan TEXT NOT NULL,
        id_ta_semester INTEGER NOT NULL,
        tp_number INTEGER NOT NULL,
        tp_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(id_penugasan, id_ta_semester, tp_number),
        FOREIGN KEY (id_ta_semester) REFERENCES TahunAjaranSemester(id_ta_semester) ON DELETE CASCADE
    );`,
    
    `CREATE TABLE IF NOT EXISTS DetailNilaiTugas (
        id_detail_nilai SERIAL PRIMARY KEY,
        id_nilai INTEGER NOT NULL,
        id_tipe_nilai INTEGER NOT NULL,
        nilai_tipe DECIMAL(5,2),
        bobot DECIMAL(3,2),
        FOREIGN KEY (id_nilai) REFERENCES Nilai(id_nilai),
        FOREIGN KEY (id_tipe_nilai) REFERENCES TipeNilai(id_tipe_nilai)
    );`,
    
    `CREATE TABLE IF NOT EXISTS StudentClassEnrollment (
        id_enrollment SERIAL PRIMARY KEY,
        id_siswa INTEGER NOT NULL,
        id_kelas INTEGER NOT NULL,
        id_ta_semester INTEGER NOT NULL,
        enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_siswa) REFERENCES Siswa(id_siswa),
        FOREIGN KEY (id_kelas) REFERENCES Kelas(id_kelas),
        FOREIGN KEY (id_ta_semester) REFERENCES TahunAjaranSemester(id_ta_semester),
        UNIQUE(id_siswa, id_kelas, id_ta_semester)
    );`,
    
    `CREATE INDEX IF NOT EXISTS idx_nilai_siswa ON Nilai(id_siswa);`,
    `CREATE INDEX IF NOT EXISTS idx_nilai_guru ON Nilai(id_guru);`,
    `CREATE INDEX IF NOT EXISTS idx_nilai_mapel ON Nilai(id_mapel);`,
    `CREATE INDEX IF NOT EXISTS idx_nilai_kelas ON Nilai(id_kelas);`,
    `CREATE INDEX IF NOT EXISTS idx_nilai_ta_semester ON Nilai(id_ta_semester);`,
    `CREATE INDEX IF NOT EXISTS idx_siswakelas_siswa ON SiswaKelas(id_siswa);`,
    `CREATE INDEX IF NOT EXISTS idx_siswakelas_kelas ON SiswaKelas(id_kelas);`,
];

async function initDb() {
    try {
        console.log('🔧 Connecting to PostgreSQL...');
        await pool.query('SELECT NOW()');
        console.log('✅ Connected to PostgreSQL\n');

        console.log('📋 Creating tables...');
        for (let i = 0; i < createTablesSQL.length; i++) {
            const sql = createTablesSQL[i];
            try {
                await pool.query(sql);
                console.log(`✅ Table ${i + 1}/${createTablesSQL.length} created`);
            } catch (err) {
                console.error(`❌ Error on table ${i + 1}: ${err.message}`);
            }
        }

        console.log('\n✅ All tables created successfully!');
        
        // Seed minimal data for testing
        console.log('\n📦 Seeding test data...');
        const { createHash } = require('crypto');
        
        // Create test admin user with SHA256 hash (same format as Python hashlib.sha256)
        const adminPassword = 'admin123';
        const adminPasswordHash = createHash('sha256').update(adminPassword).digest('hex');
        
        try {
            await pool.query(
                `INSERT INTO Admin (username, password_hash, nama, last_login_timestamp) 
                 VALUES ($1, $2, $3, NULL)
                 ON CONFLICT (username) DO NOTHING`,
                ['admin', adminPasswordHash, 'Administrator']
            );
            console.log('✅ Test admin user created: username=admin, password=admin123');
        } catch (err) {
            if (!err.message.includes('UNIQUE constraint')) {
                console.error('❌ Error seeding admin:', err.message);
            }
        }
        
        // Create test guru user
        const guruPassword = 'guru123';
        const guruPasswordHash = createHash('sha256').update(guruPassword).digest('hex');
        
        try {
            await pool.query(
                `INSERT INTO Guru (id_guru, username, password_hash, nama_guru, email, last_login_timestamp)
                 VALUES ($1, $2, $3, $4, $5, NULL)
                 ON CONFLICT (id_guru) DO NOTHING`,
                ['GURU001', 'guru1', guruPasswordHash, 'Guru Test Satu', 'guru1@test.com']
            );
            console.log('✅ Test guru user created: id_guru=GURU001, username=guru1, password=guru123');
        } catch (err) {
            if (!err.message.includes('UNIQUE constraint')) {
                console.error('❌ Error seeding guru:', err.message);
            }
        }
        
        await pool.end();
        console.log('\n✅ Connection closed');
        
    } catch (err) {
        console.error('❌ Fatal error:', err.message);
        process.exit(1);
    }
}

// Export so server can call the initializer (idempotent).
module.exports = initDb;

// If run directly (CLI), execute initialization
if (require.main === module) {
    initDb();
}
