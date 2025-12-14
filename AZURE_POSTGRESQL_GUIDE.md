# 🚀 PostgreSQL di Azure: Migration Strategy

## 📊 Opsi untuk Production Azure

Ada 3 opsi untuk database di Azure:

### Opsi 1: ❌ SQLite di Azure Files (Current)
```
✅ Pro: Simple, no new setup
❌ Con: Concurrent users issue, single file bottleneck
❌ Not recommended for production
```

### Opsi 2: ✅ Azure Database for PostgreSQL (RECOMMENDED)
```
✅ Pro: Managed service, auto-backup, scalable
✅ Pro: Native PostgreSQL, high availability
✅ Pro: Monitoring, security built-in
✅ Pro: Easy migration dari SQLite

❌ Con: Cost ~$50-100/month (but you get what you pay for)
```

### Opsi 3: 🆗 PostgreSQL di VM (Self-managed)
```
✅ Pro: Full control, cheaper than managed
❌ Con: Maintenance yourself, backup yourself
❌ Con: More complex setup
```

---

## 🎯 RECOMMENDED: Azure Database for PostgreSQL

### Alasan:
1. **Managed Service**: Auto-backup, auto-patching, monitoring
2. **Scalable**: Bisa add capacity tanpa downtime
3. **Secure**: Built-in SSL, firewall, VPC
4. **Cost-effective**: For school use case ~$50-70/month
5. **Easy Migration**: Azure punya tools native untuk migrate

---

## 🔄 Migration Strategy untuk Azure

### Langkah-Langkah:

#### STEP 1: Create Azure Database for PostgreSQL
- Create di Azure Portal (~5 menit)
- Get connection string

#### STEP 2: Migrate Data Locally First
- Setup PostgreSQL lokal
- Migrate data dari SQLite → lokal PostgreSQL
- Test everything works locally

#### STEP 3: Backup & Restore ke Azure
- Export PostgreSQL database
- Import ke Azure PostgreSQL
- Verify data

#### STEP 4: Update Azure App Service
- Change `.env` connection string
- Point ke Azure PostgreSQL

#### STEP 5: Deploy & Test
- Push update ke Azure
- Test all endpoints
- Monitor logs

---

## 💻 Setup Azure Database for PostgreSQL

### STEP 1: Create Resource (Azure Portal)

1. Go to: https://portal.azure.com
2. Search: **Azure Database for PostgreSQL**
3. Click **Create**
4. Isi form:
   ```
   - Resource group: sinfomik-rg (existing)
   - Server name: sinfomik-db (must be unique)
   - Data source: None (create new)
   - Location: Southeast Asia
   - PostgreSQL version: 14 or 15
   - Compute + Storage: 
     - Compute: Burstable B1ms (cheapest)
     - Storage: 32 GB
   - Admin username: pgadmin
   - Admin password: YourStrongPassword123!
   ```
5. Click **Review + Create** → **Create**
6. Wait 2-3 minutes

### STEP 2: Get Connection String

1. Buka server yang baru dibuat
2. Klik **Connection strings** (di menu kiri)
3. Copy connection string untuk **Node.js**:
   ```
   postgresql://pgadmin:password@sinfomik-db.postgres.database.azure.com:5432/postgres?ssl=true
   ```

### STEP 3: Allow App Service to Connect

1. Di server PostgreSQL, klik **Networking** (left menu)
2. Under **Firewall rules**, click **+ Add current client IP**
3. Add Azure App Service:
   - Click **+ Allow public access from any Azure service on this server**
   - Turn **ON**
4. Click **Save**

### STEP 4: Create Database & User

Connect dari lokal ke Azure:

```bash
# Using psql (replace with actual values)
psql -h sinfomik-db.postgres.database.azure.com \
     -U pgadmin@sinfomik-db \
     -d postgres

# Once connected:
CREATE DATABASE sinfomik;
CREATE USER sinfomik_user WITH PASSWORD 'SecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE sinfomik TO sinfomik_user;
```

---

## 🚀 Migration Process

### Local → Azure Flow:

```
1. SQLite (local)
   ↓
2. PostgreSQL (local) 
   ↓ (backup using pg_dump)
3. PostgreSQL (Azure)
   ↓
4. Test
   ↓
5. Update .env & Deploy to Azure App Service
```

---

## 📝 Updated .env for Azure

File: `backend/.env`

```env
# PostgreSQL at Azure
DB_TYPE=postgresql
DB_HOST=sinfomik-db.postgres.database.azure.com
DB_PORT=5432
DB_NAME=sinfomik
DB_USER=sinfomik_user@sinfomik-db
DB_PASSWORD=SecurePassword123!

# Azure SSL requirement
DB_SSL=require

# Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=20

# Other settings
PORT=8080
NODE_ENV=production
JWT_SECRET=your_secret_key_min_32_chars
FRONTEND_URL=https://sinfomik-frontend.azurewebsites.net
```

---

## 🔐 Security Notes

⚠️ **IMPORTANT**: 
- Don't commit `.env` with real passwords to GitHub
- Use Azure Key Vault untuk production
- Or set environment variables via Azure Portal (safer)

### Setup via Azure Portal Instead:

1. Go to App Service → Configuration
2. Add application settings directly:
   - `DB_HOST` = sinfomik-db.postgres.database.azure.com
   - `DB_USER` = sinfomik_user@sinfomik-db
   - `DB_PASSWORD` = (click lock icon for secrets)
   - etc.

---

## 💰 Cost Estimate (Azure PostgreSQL)

| Component | Cost/Month |
|-----------|-----------|
| Azure Database (Burstable B1ms) | ~$50 |
| Storage (32GB) | Included |
| Backup (7 days retention) | Included |
| App Service (Basic B1) | ~$13 |
| **Total** | ~**$63-70** |

---

## ✅ Checklist untuk Azure PostgreSQL

- [ ] Azure subscription active
- [ ] Resource group created (`sinfomik-rg`)
- [ ] Azure Database for PostgreSQL created
- [ ] Firewall rules configured
- [ ] Database & user created
- [ ] Connection string obtained
- [ ] Local migration complete & tested
- [ ] Data backed up
- [ ] `.env` updated dengan Azure credentials
- [ ] Backend deployed ke Azure App Service
- [ ] Test endpoints working

---

## 📋 Timeline

If you follow these steps:
- Setup Azure DB: **10 minutes**
- Migrate data locally: **5 minutes**
- Backup & restore: **5 minutes**
- Update & deploy: **10 minutes**
- Testing: **5 minutes**

**Total: ~35 minutes**

---

## ❓ Question untuk kamu:

1. **Sudah ada Azure subscription?**
   - Yes → Lanjut ke create Azure Database
   - No → Setup free trial dulu

2. **Budget ok untuk ~$70/month?**
   - Yes → Azure PostgreSQL recommended
   - No → Keep local PostgreSQL, skip cloud for now

Let me know! Saya ready bantu dengan step-by-step. 🚀
