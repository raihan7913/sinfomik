# 📋 Migration Guide: SQLite → PostgreSQL

## 🚀 Step 1: Install PostgreSQL (Windows)

### Opsi A: Download Installer (Recommended)
1. Download dari: https://www.postgresql.org/download/windows/
2. Pilih **PostgreSQL 15 or 16** (latest stable)
3. Jalankan installer
4. **PENTING:** Ingat password untuk superuser `postgres`
5. Default port: `5432`

### Opsi B: Menggunakan Package Manager (Chocolatey)
```powershell
# Jalankan PowerShell sebagai Administrator
choco install postgresql

# Verifikasi instalasi
psql --version
```

---

## 🔧 Step 2: Create Database & User

Setelah PostgreSQL terinstall, buka **psql** (PostgreSQL command line):

```sql
-- Connect as superuser
psql -U postgres

-- Create database
CREATE DATABASE sinfomik;

-- Create dedicated user (lebih aman)
CREATE USER sinfomik_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE sinfomik TO sinfomik_user;

-- Connect to new database and grant schema privileges
\c sinfomik
GRANT ALL PRIVILEGES ON SCHEMA public TO sinfomik_user;

-- Exit psql
\q
```

---

## 📝 Step 3: Environment Variables

Tambahkan ke `.env` file di backend:

```env
# PostgreSQL Configuration
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sinfomik
DB_USER=sinfomik_user
DB_PASSWORD=your_secure_password

# Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=10
```

---

## 🗄️ Step 4: Schema Migration

PostgreSQL memiliki beberapa perbedaan syntax dari SQLite:

### Perbedaan Utama:
1. **AUTOINCREMENT** → `SERIAL` atau `BIGSERIAL`
2. **INTEGER PRIMARY KEY** → `id INTEGER PRIMARY KEY` atau `id SERIAL PRIMARY KEY`
3. **BOOLEAN** → Bisa pakai `BOOLEAN` (lebih jelas dari SQLite)
4. **Text type** → Sama, tapi PostgreSQL lebih strict dengan type casting
5. **UNIQUE constraints** → Syntax sama, tapi lebih robust

### Generate schema PostgreSQL:

Gunakan `init_db_postgres.js` (akan dibuat di step berikutnya)

---

## 📊 Step 5: Migrate Data dari SQLite

Script akan:
1. Read dari SQLite database
2. Transform data (handle timestamp, boolean, etc)
3. Insert ke PostgreSQL

Jalankan:
```bash
node backend/src/migrate_to_postgres.js
```

---

## 🔄 Step 6: Update Database Config

File: `backend/src/config/db.js`
- Update untuk menggunakan `pg` module
- Support async/await queries
- Connection pooling

---

## ✅ Step 7: Test & Verify

```bash
# Start backend
npm start

# Cek di logs:
# ✅ "Connected to PostgreSQL database"
# ✅ Schema initialized
# ✅ No errors

# Test endpoints:
curl http://localhost:5000/api/auth/login
curl http://localhost:5000/api/admin/teachers
```

---

## 🚨 Rollback Plan (jika ada masalah)

```sql
-- Drop PostgreSQL database (HATI-HATI!)
DROP DATABASE sinfomik;

-- Kembali ke SQLite
npm install sqlite3  # kalau perlu
# Update .env kembali ke SQLite config
```

---

## 📋 Checklist

- [ ] PostgreSQL installed dan running
- [ ] Database `sinfomik` created
- [ ] User `sinfomik_user` created
- [ ] `.env` file updated dengan PostgreSQL credentials
- [ ] `db.js` updated untuk PostgreSQL
- [ ] Schema migrated
- [ ] Data migrated
- [ ] All tests passing
- [ ] Backup data tersedia (jaga-jaga)

---

## ⏭️ Next Steps

1. Tunggu saya buat file migration script
2. Saya akan update `db.js` untuk PostgreSQL
3. Saya akan buat `init_db_postgres.js`
4. Kita test migration bersama
