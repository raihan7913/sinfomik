# 🚀 PostgreSQL Migration: Langkah Demi Langkah

## ✅ Completed Steps:
- [x] Package `pg` sudah di-install di backend
- [x] File config `db_postgres.js` sudah dibuat
- [x] Schema migration script `init_db_postgres.js` sudah dibuat
- [x] Data migration script `migrate_to_postgres.js` sudah dibuat
- [x] Template `.env.postgres.example` sudah dibuat

---

## 📋 Langkah-Langkah Selanjutnya:

### STEP 1️⃣: Install PostgreSQL di Windows (5 menit)

Kunjungi: https://www.postgresql.org/download/windows/

**Pilihan A: Download Installer (Recommended)**
1. Click "Download the installer"
2. Pilih **PostgreSQL 15 or 16** (latest stable)
3. Jalankan `.exe` file
4. Follow wizard:
   - Pilih lokasi install (default OK)
   - **PENTING:** Ingat password untuk user `postgres` (default port 5432)
   - Finish

**Pilihan B: Pakai Chocolatey** (jika sudah install)
```powershell
# Buka PowerShell as Administrator
choco install postgresql

# Confirm installation
psql --version
```

**Test PostgreSQL:**
```powershell
psql -U postgres -c "SELECT version();"
```

---

### STEP 2️⃣: Setup Database & User (3 menit)

Buka **pgAdmin** atau command line:

```powershell
# Buka psql (PostgreSQL command line)
psql -U postgres
```

**Di dalam psql, jalankan:**

```sql
-- Create database
CREATE DATABASE sinfomik;

-- Create user dengan password
CREATE USER sinfomik_user WITH PASSWORD 'sinfomik123';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE sinfomik TO sinfomik_user;

-- Connect ke database baru
\c sinfomik

-- Grant schema privileges
GRANT ALL PRIVILEGES ON SCHEMA public TO sinfomik_user;

-- Exit psql
\q
```

✅ Database setup selesai!

---

### STEP 3️⃣: Update `.env` File Backend (2 menit)

Buka file: `backend/.env`

Ganti/tambahkan dengan ini:

```env
# PostgreSQL Configuration
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sinfomik
DB_USER=sinfomik_user
DB_PASSWORD=sinfomik123

# Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=20

# Existing settings (keep as is)
PORT=5000
NODE_ENV=development
JWT_SECRET=your_existing_secret
JWT_EXPIRES_IN=5h
JWT_WARNING_TIME=1800000
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=2000
```

✅ Environment variables ready!

---

### STEP 4️⃣: Backup Data SQLite (Penting!)

```powershell
# Di backend folder
cp academic_dashboard.db academic_dashboard.db.backup
```

✅ Backup created!

---

### STEP 5️⃣: Create Schema di PostgreSQL (2 menit)

```powershell
# Di backend folder
node src/init_db_postgres.js
```

**Expected output:**
```
🔧 Starting PostgreSQL database initialization...
✅ All tables created successfully
📥 Seeding default data...
✅ Default data seeded
✅ Database initialization complete!
```

✅ Schema initialized!

---

### STEP 6️⃣: Migrate Data dari SQLite ke PostgreSQL (5-10 menit)

```powershell
# Di backend folder
node src/migrate_to_postgres.js
```

**Expected output:**
```
🔄 Starting data migration from SQLite to PostgreSQL...

📋 Found X tables to migrate:

⏳ Migrating Admin...
✅ Admin migrated

⏳ Migrating Guru...
✅ Guru migrated

... (more tables) ...

==================================================
🎉 Migration Complete!
📊 Total records migrated: XXXX
❌ Total errors: 0
==================================================
```

✅ Data migrated!

---

### STEP 7️⃣: Update Backend Config (2 menit)

**File: `backend/src/config/db.js`**

Replace dengan isi file `db_postgres.js`:

```bash
# Copy db_postgres.js menjadi db.js
cp src/config/db_postgres.js src/config/db.js
```

Atau manual:
1. Buka `backend/src/config/db_postgres.js`
2. Copy semua isinya
3. Paste ke `backend/src/config/db.js`
4. Save

✅ Config updated!

---

### STEP 8️⃣: Update server.js untuk PostgreSQL Init

**File: `backend/src/server.js`**

Cari line yang ada:
```javascript
const { getDb } = require('./config/db');
```

Kemudian cari bagian initialization database (sekitar line yang ada `init_db`):

Change dari:
```javascript
const initDb = require('./init_db');
if (typeof initDb === 'function') {
    initDb();
}
```

Menjadi:
```javascript
const initDbPostgres = require('./init_db_postgres');
if (typeof initDbPostgres === 'function') {
    initDbPostgres().catch(err => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });
}
```

✅ Server init updated!

---

### STEP 9️⃣: Test Backend (5 menit)

```powershell
# Di backend folder
npm start
```

**Expected output:**
```
Server is running on port 5000
Connected to PostgreSQL database
✅ All tables created successfully
✅ Database initialization complete!
```

Jika ada error, screenshot dan share!

✅ Backend running!

---

### STEP 🔟: Test API Endpoints

**Open browser atau gunakan curl:**

```bash
# Test login endpoint
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Expected response:
# {"token":"...", "user":{"id_admin":1, "username":"admin"}}
```

**Test teacher endpoint:**
```bash
# Get token dulu, then:
curl -X GET http://localhost:5000/api/admin/teachers \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: List of teachers (bisa empty kalau belum ada data)
```

✅ API working!

---

### STEP 1️⃣1️⃣: Cleanup (Optional)

Kalau migration successful, bisa delete SQLite file:

```powershell
# Backup sudah ada, jadi safe to delete
rm academic_dashboard.db
```

---

## ✅ Checklist Migration

- [ ] PostgreSQL installed & running
- [ ] Database `sinfomik` created
- [ ] User `sinfomik_user` created
- [ ] `.env` file updated dengan PostgreSQL credentials
- [ ] SQLite data backup dibuat
- [ ] `init_db_postgres.js` run berhasil
- [ ] `migrate_to_postgres.js` run berhasil (0 errors)
- [ ] `backend/src/config/db.js` updated dengan `db_postgres.js`
- [ ] `server.js` updated untuk init PostgreSQL
- [ ] Backend berjalan tanpa error
- [ ] API endpoints testable

---

## 🚨 Troubleshooting

### Error: "psql command not found"
✅ Solusi: PostgreSQL belum di-install atau PATH belum update. Restart terminal setelah install.

### Error: "FATAL: password authentication failed"
✅ Solusi: Double-check password di `.env` sesuai dengan password saat setup PostgreSQL

### Error: "Database does not exist"
✅ Solusi: Jalankan lagi:
```sql
CREATE DATABASE sinfomik;
```

### Error: "column does not exist"
✅ Solusi: Schema belum di-create. Jalankan:
```bash
node src/init_db_postgres.js
```

### Error: "Connection refused"
✅ Solusi: PostgreSQL service tidak running.
```powershell
# Windows: Check di Services atau
pg_isready -h localhost -p 5432
```

---

## 📞 Questions?

Kalau ada yang stuck, screenshot error dan saya bantu! 🎯
