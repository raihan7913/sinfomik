# Time Series Analysis & Early Warning System - Implementation Guide

## 📋 Overview

Sistem ini telah diimplementasikan dengan **Trend Analysis** dan **Early Warning Detection** untuk monitoring perkembangan nilai siswa SD.

## 🎯 Fitur yang Diimplementasikan

### 1. **Trend Analysis (Linear Regression)**
- Deteksi tren nilai siswa: Naik, Stabil, atau Turun
- Perhitungan slope (perubahan per semester)
- Confidence level berdasarkan jumlah data
- Interpretasi otomatis dengan konteks

**Minimum Data Required:** 2 semester (dengan warning), **Recommended:** 3+ semester

### 2. **Simple Forecasting**
- Prediksi nilai semester depan
- Confidence interval (range prediksi)
- Metode: Linear Regression extrapolation

**Minimum Data Required:** 3 semester

### 3. **Early Warning Detection**

#### a. Sudden Drop Detection (Min: 2 semester)
- Deteksi penurunan drastis (> 15 poin)
- Severity: **CRITICAL**
- Prioritas tertinggi untuk intervensi

#### b. Below KKM Detection (Min: 2 semester)
- Deteksi nilai di bawah KKM berturut-turut
- Default KKM: 60
- Severity: **HIGH**

#### c. Declining Trend Detection (Min: 3 semester)
- Deteksi penurunan konsisten
- Threshold: slope < -0.5
- Severity: **HIGH** (slope < -2) atau **MEDIUM** (slope < -1)

#### d. Predicted Failure Detection (Min: 3 semester)
- Prediksi akan gagal di semester depan
- Threshold: prediksi < 60
- Severity: **HIGH**

#### e. High Volatility Detection (Min: 4 semester)
- Deteksi performa tidak konsisten
- Threshold: std deviation > 10
- Severity: **MEDIUM**

## 📂 File Structure

```
backend/
├── src/
│   ├── config/
│   │   └── timeSeriesConfig.js          ← Konfigurasi & thresholds
│   ├── controllers/
│   │   └── timeSeriesController.js      ← API endpoints handlers
│   ├── utils/
│   │   └── timeSeriesHelpers.js         ← Core algorithms
│   └── routes/
│       └── analyticsRoutes.js           ← Updated dengan endpoints baru

frontend/
└── src/
    └── features/
        └── guru/
            └── WaliKelasGradeView.js    ← Updated dengan UI baru
```

## 🔌 API Endpoints

### 1. Get Student Time Series Analysis
```
GET /api/analytics/timeseries/student/:id_siswa
```

**Query Parameters:**
- `id_mapel` (optional): Filter by specific subject

**Response:**
```json
{
  "success": true,
  "student": {
    "id_siswa": 1001,
    "nama_siswa": "Ahmad"
  },
  "analysis": [
    {
      "id_mapel": 1,
      "nama_mapel": "Matematika",
      "dataPoints": 6,
      "historicalData": [...],
      "trend": {
        "error": false,
        "dataPoints": 6,
        "trend": "naik_stabil",
        "slope": 1.2,
        "confidence": "high",
        "interpretation": "..."
      },
      "forecast": {
        "error": false,
        "forecast": 84.2,
        "confidenceUpper": 87.7,
        "confidenceLower": 80.7
      },
      "warnings": {
        "error": false,
        "warnings": [],
        "warningCount": 0
      }
    }
  ]
}
```

### 2. Get Class Early Warnings
```
GET /api/analytics/timeseries/early-warning/class/:id_kelas?tahun_ajaran=2024/2025&semester=Ganjil
```

**Response:**
```json
{
  "success": true,
  "classInfo": {
    "id_kelas": 1,
    "nama_kelas": "Kelas 4A"
  },
  "summary": {
    "totalStudents": 25,
    "studentsWithWarnings": 5,
    "criticalCount": 2,
    "highCount": 2,
    "mediumCount": 1
  },
  "warnings": {
    "critical": [...],
    "high": [...],
    "medium": [...]
  }
}
```

### 3. Get Class Trend Summary
```
GET /api/analytics/timeseries/trend/class/:id_kelas?tahun_ajaran=2024/2025&semester=Ganjil
```

## 🎨 UI Features

### Tab Baru di Dashboard Wali Kelas

#### 1. **Student Detail View**
Saat klik detail siswa, akan muncul:
- **Time Series Analysis** untuk setiap mata pelajaran:
  - Warning jika data tidak cukup (dengan info berapa data diperlukan)
  - Trend analysis dengan confidence badge
  - Interpretasi dalam Bahasa Indonesia
  - Prediksi semester depan
  - Early warnings (jika ada)

#### 2. **Early Warning Tab**
Tab baru khusus untuk early warning:
- **Summary Cards:** Total siswa, Critical, High, Medium
- **Critical Warnings:** Siswa yang butuh perhatian SEGERA
  - Detail lengkap warning
  - Histori nilai 5 semester terakhir
  - Tombol untuk lihat detail siswa
- **High Priority Warnings:** Grid cards siswa perlu perhatian khusus
- **Medium Priority:** Collapsible list untuk monitor

## ⚙️ Konfigurasi

Edit [timeSeriesConfig.js](backend/src/config/timeSeriesConfig.js) untuk customize:

```javascript
// Ubah thresholds
TREND_ANALYSIS: {
    PRACTICAL_MIN: 3,       // Minimum semester untuk analisis
    STRONG_INCREASE: 1.0,   // Slope untuk "naik kuat"
    // ...
},

EARLY_WARNING: {
    SUDDEN_DROP: {
        THRESHOLD: -15,     // Drop berapa poin = critical
    },
    BELOW_KKM: {
        KKM_VALUE: 60,      // Nilai KKM
    },
    // ...
}
```

## 🔍 Error Handling

### Data Tidak Cukup
Sistem akan menampilkan pesan yang jelas:

**Contoh untuk Trend Analysis:**
```
❌ Tidak dapat menganalisis trend. Butuh minimal 2 semester data.
Data saat ini: 1 semester | Minimal diperlukan: 2 semester
```

**Contoh untuk Forecasting:**
```
ℹ️ Butuh minimal 3 semester data untuk prediksi yang reliable
```

### Warning Messages
Sistem menampilkan warning jika data < 3 semester:
```
⚠️ Data masih terbatas (2 semester). Analisis lebih akurat dengan 3+ semester data.
```

### Confidence Indicators
Setiap analisis menampilkan confidence badge:
- 🔴 **Sangat Rendah** (2 data)
- 🟡 **Rendah** (3 data)
- 🔵 **Sedang** (4-5 data)
- 🟢 **Tinggi** (6-8 data)
- 🟢 **Sangat Tinggi** (9+ data)

## 🧪 Testing

### Manual Testing Steps:

1. **Login sebagai Guru/Wali Kelas**
2. **Buka Dashboard Wali Kelas**
3. **Pilih Kelas**
4. **Test Scenario 1: Siswa dengan data cukup (4+ semester)**
   - Klik detail siswa
   - Verify trend analysis muncul tanpa error
   - Verify forecast muncul
   - Check warnings (jika ada)

5. **Test Scenario 2: Siswa dengan data minimal (2-3 semester)**
   - Verify warning message muncul
   - Verify confidence badge = "Rendah" atau "Sangat Rendah"
   - Verify analisis tetap ditampilkan (dengan disclaimer)

6. **Test Scenario 3: Siswa baru (1 semester)**
   - Verify error message: "Tidak dapat menganalisis trend"
   - Verify tidak ada analisis ditampilkan

7. **Test Early Warning Tab**
   - Klik tab "Early Warning"
   - Verify summary cards muncul
   - Verify siswa dengan warning terlist dengan kategori yang benar
   - Test tombol "Lihat Detail Siswa"

### Expected Results:

✅ Trend analysis bekerja dengan minimum 2 data (ada warning)  
✅ Forecasting bekerja dengan minimum 3 data  
✅ Early warnings terdeteksi dengan benar berdasarkan severity  
✅ UI responsif dan error messages jelas  
✅ Confidence level sesuai jumlah data  

## 📊 Data Requirements Summary

| Fitur | Min Absolut | Min Praktis | Ideal | Confidence |
|-------|-------------|-------------|-------|------------|
| **Trend Analysis** | 2 | 3 | 6 | Rendah → Tinggi |
| **Forecasting** | 3 | 4 | 6 | Rendah → Tinggi |
| **Sudden Drop** | 2 | 2 | - | Selalu reliable |
| **Below KKM** | 2 | 2 | - | Selalu reliable |
| **Declining Trend** | 3 | 3 | 6 | Sedang → Tinggi |
| **Predicted Failure** | 3 | 3 | 6 | Sedang → Tinggi |
| **High Volatility** | 4 | 4 | 6 | Sedang → Tinggi |

## 🎓 Untuk Sidang Skripsi

### Yang Bisa Dijelaskan:

1. **Time Series Components:**
   - Descriptive: Trend Analysis (memahami pola masa lalu)
   - Predictive: Forecasting (prediksi masa depan)
   - Prescriptive: Early Warning (rekomendasi aksi)

2. **Algoritma:**
   - Linear Regression untuk trend & forecast
   - Statistical measures (slope, std deviation)
   - Z-score concepts untuk volatility

3. **Metodologi:**
   - Confidence level based on data availability
   - Multi-level severity (Critical → Medium)
   - Transparent error handling

4. **Manfaat:**
   - Intervensi preventif untuk siswa berisiko
   - Data-driven decision making untuk guru
   - Transparansi perkembangan untuk orang tua

### Judul yang Sesuai:
> **"SISTEM INFORMASI AKADEMIK DENGAN ANALISIS TIME SERIES DAN EARLY WARNING SYSTEM UNTUK MONITORING DAN PREDIKSI PERKEMBANGAN NILAI SISWA SEKOLAH DASAR (STUDI KASUS: SD BINEKAS)"**

## 🚀 Next Steps

1. ✅ **Testing di production environment**
2. ✅ **Populate database dengan data multi-semester**
3. ✅ **User acceptance testing dengan guru**
4. ✅ **Dokumentasi user manual**
5. ✅ **Prepare presentasi untuk sidang**

## 📝 Notes

- Semua error handling sudah terimplementasi
- UI menampilkan pesan yang user-friendly
- Sistem transparent tentang keterbatasan data
- Bisa berjalan dengan data minimal (2 semester) tapi dengan proper warnings
- Scalable untuk future improvements (ARIMA, ML models, dll)

---

**Implementasi Selesai!** ✨

Sistem siap digunakan dan dipertanggungjawabkan dalam sidang skripsi.
