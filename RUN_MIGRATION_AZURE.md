# Jalankan Migration di Azure PostgreSQL

## Cara 1: Via Azure Portal SSH (Recommended)

1. Buka **Azure Portal** → App Service → **SSH** (di menu sebelah kiri)
2. Atau buka langsung: `https://<app-name>.scm.azurewebsites.net/webssh/host`
3. Di terminal SSH, jalankan:

```bash
# Navigate ke backend folder
cd /home/site/wwwroot/backend/src

# Jalankan migration script
node migrate_siswa_id_to_text.js
```

## Cara 2: Via Kudu Console

1. Buka: `https://<app-name>.scm.azurewebsites.net/DebugConsole`
2. Navigate: `site/wwwroot/backend/src`
3. Klik pada `migrate_siswa_id_to_text.js` → pilih Console
4. Run: `node migrate_siswa_id_to_text.js`

## Cara 3: Via Local Terminal with Azure CLI

```bash
# Install Azure CLI jika belum: https://aka.ms/installazurecli

# Login
az login

# SSH ke App Service
az webapp ssh --name <app-name> --resource-group <resource-group>

# Di dalam SSH:
cd /home/site/wwwroot/backend/src
node migrate_siswa_id_to_text.js
```

## Expected Output

Migration akan menampilkan progress:
```
🔄 Starting migration: id_siswa INTEGER -> TEXT (PostgreSQL)
📂 Database: sinfomik @ xxxxx.postgres.database.azure.com
✅ Connected to PostgreSQL

🔄 Transaction started

📋 Step 1: Checking current schema...
Current data type: integer
⚠️  Migration needed: id_siswa is currently integer, will convert to TEXT

📋 Step 2: Dropping foreign key constraints...
✅ Dropped FK: siswakelas_ibfk_1
✅ Dropped FK: nilai_ibfk_1
...

📋 Step 3: Altering columns to TEXT...
✅ Altered siswa.id_siswa to TEXT
✅ Altered siswakelas.id_siswa to TEXT
✅ Altered nilai.id_siswa to TEXT
...

📋 Step 4: Recreating foreign key constraints...
✅ Created FK: siswakelas_id_siswa_fkey
✅ Created FK: nilai_id_siswa_fkey
...

📋 Step 5: Verifying schema...
✅ All columns verified as TEXT

✅ Migration completed successfully!
🎉 id_siswa is now TEXT in all tables
```

## Jika Migration Gagal

Jika ada error, migration akan ROLLBACK otomatis. Check error message dan:

1. Pastikan .env file ada dan benar di Azure
2. Pastikan database credentials valid
3. Pastikan tidak ada active connection yang lock tables

## After Migration

1. **Test Manual Input:** Input NISN dengan leading zeros (0213456789)
2. **Test Excel Import:** Import siswa dengan NISN beragam
3. **Test Enrollment Import:** Import enrollment dengan NISN yang ada

## Rollback (jika diperlukan)

Migration ada safeguard:
- Wrapped dalam transaction
- Auto-rollback on error
- Tidak akan running twice (ada check di awal)

Jika perlu manual rollback:
```sql
-- Hanya jalankan jika migration partial dan stuck
BEGIN;
ALTER TABLE siswa ALTER COLUMN id_siswa TYPE INTEGER USING id_siswa::integer;
ALTER TABLE siswakelas ALTER COLUMN id_siswa TYPE INTEGER USING id_siswa::integer;
-- ... dst untuk semua tabel
COMMIT;
```

⚠️ **PENTING:** Backup database sebelum migration!
