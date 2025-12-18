// backend/src/init_db_postgres.js
// PostgreSQL Schema Initialization (Complete - same as SQLite init_db.js)
// Gunakan untuk membuat table structure di PostgreSQL

const { getPool } = require('./config/db_postgres');
const { createHash } = require('crypto');
const { format, addDays } = require('date-fns');

function hashPasswordPythonStyle(password) {
    return createHash('sha256').update(password).digest('hex');
}

async function initializeDatabasePostgres() {
    const pool = getPool();

    try {
        console.log('🔧 Starting PostgreSQL database initialization...');

        // SQL untuk membuat tabel (PostgreSQL syntax - LENGKAP seperti SQLite)
        const createTablesSQL = `
            -- Admin Table
            CREATE TABLE IF NOT EXISTS admin (
                id_admin SERIAL PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                nama TEXT NOT NULL,
                role TEXT DEFAULT 'admin',
                last_login_timestamp BIGINT
            );

            -- Guru Table
            CREATE TABLE IF NOT EXISTS guru (
                id_guru TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                nama_guru TEXT NOT NULL,
                email TEXT UNIQUE,
                is_admin BOOLEAN DEFAULT FALSE,
                last_login_timestamp BIGINT
            );

            -- Siswa Table
            CREATE TABLE IF NOT EXISTS siswa (
                id_siswa INTEGER PRIMARY KEY,
                nama_siswa TEXT NOT NULL,
                tanggal_lahir TEXT,
                jenis_kelamin TEXT,
                tahun_ajaran_masuk TEXT
            );

            -- TahunAjaranSemester Table
            CREATE TABLE IF NOT EXISTS tahunajaransemester (
                id_ta_semester SERIAL PRIMARY KEY,
                tahun_ajaran TEXT NOT NULL,
                semester TEXT NOT NULL,
                is_aktif BOOLEAN DEFAULT FALSE,
                UNIQUE(tahun_ajaran, semester)
            );

            -- Kelas Table
            CREATE TABLE IF NOT EXISTS kelas (
                id_kelas SERIAL PRIMARY KEY,
                nama_kelas TEXT NOT NULL,
                id_wali_kelas TEXT,
                id_ta_semester INTEGER NOT NULL,
                FOREIGN KEY (id_wali_kelas) REFERENCES guru(id_guru),
                FOREIGN KEY (id_ta_semester) REFERENCES tahunajaransemester(id_ta_semester),
                UNIQUE(nama_kelas, id_ta_semester)
            );

            -- MataPelajaran Table
            CREATE TABLE IF NOT EXISTS matapelajaran (
                id_mapel SERIAL PRIMARY KEY,
                nama_mapel TEXT NOT NULL UNIQUE
            );

            -- TipeNilai Table
            CREATE TABLE IF NOT EXISTS tipenilai (
                id_tipe_nilai SERIAL PRIMARY KEY,
                nama_tipe TEXT NOT NULL UNIQUE,
                deskripsi TEXT
            );

            -- SiswaKelas Table
            CREATE TABLE IF NOT EXISTS siswakelas (
                id_siswa_kelas SERIAL PRIMARY KEY,
                id_siswa INTEGER NOT NULL,
                id_kelas INTEGER NOT NULL,
                id_ta_semester INTEGER NOT NULL,
                FOREIGN KEY (id_siswa) REFERENCES siswa(id_siswa),
                FOREIGN KEY (id_kelas) REFERENCES kelas(id_kelas),
                FOREIGN KEY (id_ta_semester) REFERENCES tahunajaransemester(id_ta_semester),
                UNIQUE(id_siswa, id_kelas, id_ta_semester)
            );

            -- GuruMataPelajaranKelas Table
            CREATE TABLE IF NOT EXISTS gurumatapelajarankelas (
                id_guru_mapel_kelas SERIAL PRIMARY KEY,
                id_guru TEXT NOT NULL,
                id_mapel INTEGER NOT NULL,
                id_kelas INTEGER NOT NULL,
                id_ta_semester INTEGER NOT NULL,
                is_wali_kelas BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (id_guru) REFERENCES guru(id_guru),
                FOREIGN KEY (id_mapel) REFERENCES matapelajaran(id_mapel),
                FOREIGN KEY (id_kelas) REFERENCES kelas(id_kelas),
                FOREIGN KEY (id_ta_semester) REFERENCES tahunajaransemester(id_ta_semester),
                UNIQUE(id_guru, id_mapel, id_kelas, id_ta_semester)
            );

            -- Nilai Table (dengan semua kolom seperti SQLite)
            CREATE TABLE IF NOT EXISTS nilai (
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
                FOREIGN KEY (id_siswa) REFERENCES siswa(id_siswa),
                FOREIGN KEY (id_guru) REFERENCES guru(id_guru),
                FOREIGN KEY (id_mapel) REFERENCES matapelajaran(id_mapel),
                FOREIGN KEY (id_kelas) REFERENCES kelas(id_kelas),
                FOREIGN KEY (id_ta_semester) REFERENCES tahunajaransemester(id_ta_semester),
                UNIQUE(id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp)
            );

            -- CapaianPembelajaran Table
            CREATE TABLE IF NOT EXISTS capaianpembelajaran (
                id_cp SERIAL PRIMARY KEY,
                id_mapel INTEGER NOT NULL,
                fase TEXT,
                deskripsi_cp TEXT NOT NULL,
                file_path TEXT,
                FOREIGN KEY (id_mapel) REFERENCES matapelajaran(id_mapel),
                UNIQUE(id_mapel, fase)
            );

            -- SiswaCapaianPembelajaran Table
            CREATE TABLE IF NOT EXISTS siswacapaianpembelajaran (
                id_siswa_cp SERIAL PRIMARY KEY,
                id_siswa INTEGER NOT NULL,
                id_cp INTEGER NOT NULL,
                id_guru TEXT NOT NULL,
                id_ta_semester INTEGER NOT NULL,
                status_capaian TEXT NOT NULL,
                tanggal_penilaian TEXT NOT NULL,
                catatan TEXT,
                FOREIGN KEY (id_siswa) REFERENCES siswa(id_siswa),
                FOREIGN KEY (id_cp) REFERENCES capaianpembelajaran(id_cp),
                FOREIGN KEY (id_guru) REFERENCES guru(id_guru),
                FOREIGN KEY (id_ta_semester) REFERENCES tahunajaransemester(id_ta_semester),
                UNIQUE(id_siswa, id_cp, id_ta_semester)
            );

            -- KKM_Settings Table
            CREATE TABLE IF NOT EXISTS kkm_settings (
                id_kkm SERIAL PRIMARY KEY,
                id_guru TEXT NOT NULL,
                id_mapel INTEGER NOT NULL,
                id_kelas INTEGER NOT NULL,
                id_ta_semester INTEGER NOT NULL,
                jenis_nilai TEXT NOT NULL CHECK (jenis_nilai IN ('TP', 'UAS', 'FINAL')),
                urutan_tp INTEGER,
                nilai_kkm REAL NOT NULL,
                tanggal_update TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_guru) REFERENCES guru(id_guru),
                FOREIGN KEY (id_mapel) REFERENCES matapelajaran(id_mapel),
                FOREIGN KEY (id_kelas) REFERENCES kelas(id_kelas),
                FOREIGN KEY (id_ta_semester) REFERENCES tahunajaransemester(id_ta_semester),
                UNIQUE(id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp)
            );

            -- manual_tp Table
            CREATE TABLE IF NOT EXISTS manual_tp (
                id_manual_tp SERIAL PRIMARY KEY,
                id_penugasan TEXT NOT NULL,
                id_ta_semester INTEGER NOT NULL,
                tp_number INTEGER NOT NULL,
                tp_name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(id_penugasan, id_ta_semester, tp_number),
                FOREIGN KEY (id_ta_semester) REFERENCES tahunajaransemester(id_ta_semester) ON DELETE CASCADE
            );

            -- DetailNilaiTugas Table
            CREATE TABLE IF NOT EXISTS detailnilaiugas (
                id_detail_nilai SERIAL PRIMARY KEY,
                id_nilai INTEGER NOT NULL,
                id_tipe_nilai INTEGER NOT NULL,
                nilai_tipe DECIMAL(5,2),
                bobot DECIMAL(3,2),
                FOREIGN KEY (id_nilai) REFERENCES nilai(id_nilai),
                FOREIGN KEY (id_tipe_nilai) REFERENCES tipenilai(id_tipe_nilai)
            );

            -- StudentClassEnrollment Table
            CREATE TABLE IF NOT EXISTS studentclassenrollment (
                id_enrollment SERIAL PRIMARY KEY,
                id_siswa INTEGER NOT NULL,
                id_kelas INTEGER NOT NULL,
                id_ta_semester INTEGER NOT NULL,
                enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_siswa) REFERENCES siswa(id_siswa),
                FOREIGN KEY (id_kelas) REFERENCES kelas(id_kelas),
                FOREIGN KEY (id_ta_semester) REFERENCES tahunajaransemester(id_ta_semester),
                UNIQUE(id_siswa, id_kelas, id_ta_semester)
            );

            -- Create Indexes
            CREATE INDEX IF NOT EXISTS idx_nilai_siswa ON nilai(id_siswa);
            CREATE INDEX IF NOT EXISTS idx_nilai_guru ON nilai(id_guru);
            CREATE INDEX IF NOT EXISTS idx_nilai_mapel ON nilai(id_mapel);
            CREATE INDEX IF NOT EXISTS idx_nilai_kelas ON nilai(id_kelas);
            CREATE INDEX IF NOT EXISTS idx_nilai_ta_semester ON nilai(id_ta_semester);
            CREATE INDEX IF NOT EXISTS idx_siswakelas_siswa ON siswakelas(id_siswa);
            CREATE INDEX IF NOT EXISTS idx_siswakelas_kelas ON siswakelas(id_kelas);
        `;

        // Split into individual statements for PostgreSQL
        const statements = createTablesSQL.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                await pool.query(statement);
            }
        }

        console.log('✅ All tables created successfully');

        // Run idempotent schema migrations (add role/is_admin if missing)
        try {
            await pool.query("ALTER TABLE admin ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin'");
            await pool.query("ALTER TABLE guru ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE");
            await pool.query("UPDATE admin SET role = 'superadmin' WHERE username = $1", ['admin']);
            console.log('✅ Schema migrations applied (role/is_admin)');
        } catch (migErr) {
            console.warn('⚠️ Schema migration warning:', migErr.message);
        }

        // Seed complete dummy data (like SQLite)
        await seedDummyData(pool);

        console.log('✅ Database initialization complete!');

    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    }
}

// Comprehensive dummy data seeding (sama seperti SQLite)
async function seedDummyData(pool) {
    try {
        console.log('📥 Seeding dummy data...');

        // Helper functions
        const query = async (sql, params = []) => {
            try {
                const result = await pool.query(sql, params);
                return result;
            } catch (error) {
                console.error('Query error:', sql, error.message);
                throw error;
            }
        };
        const getOne = async (sql, params = []) => {
            const result = await pool.query(sql, params);
            return result.rows[0] || null;
        };
        const getAll = async (sql, params = []) => {
            const result = await pool.query(sql, params);
            return result.rows;
        };

        // --- 1. Admin ---
        let adminCount = await getOne("SELECT COUNT(*) as cnt FROM admin");
        if (adminCount.cnt === 0) {
            await query(
                "INSERT INTO admin (username, password_hash, nama) VALUES ($1, $2, $3)",
                ['admin', hashPasswordPythonStyle('admin123'), 'Super Admin']
            );
            console.log("✓ Admin seeded");
        }

        // --- 2. Guru ---
        let guruCount = await getOne("SELECT COUNT(*) as cnt FROM guru");
        if (guruCount.cnt === 0) {
            const teachers = [
                { username: 'budi.s', nama_guru: 'Pak Budi Santoso', email: 'budi.s@sekolah.com' },
                { username: 'ani.w', nama_guru: 'Ibu Ani Wijaya', email: 'ani.w@sekolah.com' },
            ];
            for (const t of teachers) {
                await query(
                    "INSERT INTO guru (id_guru, username, password_hash, nama_guru, email) VALUES ($1, $2, $3, $4, $5)",
                    [t.username, t.username, hashPasswordPythonStyle('guru123'), t.nama_guru, t.email]
                );
            }
            console.log(`✓ ${teachers.length} Guru seeded`);
        }

        // --- 3. Siswa ---
        let siswaCount = await getOne("SELECT COUNT(*) as cnt FROM siswa");
        if (siswaCount.cnt === 0) {
            const students = [
                { id_siswa: 1001, nama_siswa: 'Andi Pratama', tanggal_lahir: '2008-03-15', jenis_kelamin: 'L', tahun_ajaran_masuk: '2023/2024' },
                { id_siswa: 1002, nama_siswa: 'Budi Cahyono', tanggal_lahir: '2008-07-22', jenis_kelamin: 'L', tahun_ajaran_masuk: '2023/2024' },
                { id_siswa: 1003, nama_siswa: 'Citra Dewi', tanggal_lahir: '2009-01-10', jenis_kelamin: 'P', tahun_ajaran_masuk: '2023/2024' },
            ];
            for (const s of students) {
                await query(
                    "INSERT INTO siswa (id_siswa, nama_siswa, tanggal_lahir, jenis_kelamin, tahun_ajaran_masuk) VALUES ($1, $2, $3, $4, $5)",
                    [s.id_siswa, s.nama_siswa, s.tanggal_lahir, s.jenis_kelamin, s.tahun_ajaran_masuk]
                );
            }
            console.log(`✓ ${students.length} Siswa seeded`);
        }

        // --- 4. MataPelajaran ---
        let mapelCount = await getOne("SELECT COUNT(*) as cnt FROM matapelajaran");
        if (mapelCount.cnt === 0) {
            const subjects = ['MATEMATIKA', 'IPAS', 'BAHASA INDONESIA'];
            for (const s of subjects) {
                await query("INSERT INTO matapelajaran (nama_mapel) VALUES ($1)", [s]);
            }
            console.log(`✓ ${subjects.length} MataPelajaran seeded`);
        }

        // --- 5. TipeNilai ---
        let tipeCount = await getOne("SELECT COUNT(*) as cnt FROM tipenilai");
        if (tipeCount.cnt === 0) {
            const types = [
                { nama_tipe: 'Tugas Harian', deskripsi: 'Nilai tugas-tugas harian' },
                { nama_tipe: 'UTS', deskripsi: 'Ujian Tengah Semester' },
                { nama_tipe: 'UAS', deskripsi: 'Ujian Akhir Semester' },
            ];
            for (const t of types) {
                await query(
                    "INSERT INTO tipenilai (nama_tipe, deskripsi) VALUES ($1, $2)",
                    [t.nama_tipe, t.deskripsi]
                );
            }
            console.log(`✓ ${types.length} TipeNilai seeded`);
        }

        // --- 6. TahunAjaranSemester ---
        let taCount = await getOne("SELECT COUNT(*) as cnt FROM tahunajaransemester");
        if (taCount.cnt === 0) {
            const tas = [
                { tahun_ajaran: '2023/2024', semester: 'Ganjil', is_aktif: false },
                { tahun_ajaran: '2024/2025', semester: 'Ganjil', is_aktif: true },
            ];
            for (const t of tas) {
                await query(
                    "INSERT INTO tahunajaransemester (tahun_ajaran, semester, is_aktif) VALUES ($1, $2, $3)",
                    [t.tahun_ajaran, t.semester, t.is_aktif]
                );
            }
            console.log(`✓ ${tas.length} TahunAjaranSemester seeded`);
        }

        console.log('✅ Dummy data seeding complete');

    } catch (error) {
        console.error('Error seeding dummy data:', error);
    }
}

// Export sebagai function yang bisa di-call dari server.js
module.exports = initializeDatabasePostgres;
