// backend/src/config/timeSeriesConfig.js
// Configuration for Time Series Analysis

const TIME_SERIES_CONFIG = {
    // Trend Analysis Settings
    TREND_ANALYSIS: {
        ABSOLUTE_MIN: 2,        // Minimum untuk bisa jalan (dengan warning besar)
        PRACTICAL_MIN: 3,       // Minimum recommended untuk analisis
        IDEAL: 6,               // Data ideal untuk confidence tinggi
        
        // Thresholds untuk kategorisasi trend
        STRONG_INCREASE: 1.0,   // Slope > 1.0 = naik kuat
        MODERATE_INCREASE: 0.3, // Slope > 0.3 = naik stabil
        STABLE_RANGE: 0.3,      // ±0.3 = stabil
        MODERATE_DECREASE: -1.0, // Slope < -1.0 = turun signifikan
    },
    
    // Early Warning Settings
    EARLY_WARNING: {
        // 1. Sudden Drop Detection
        SUDDEN_DROP: {
            MIN_DATA: 2,
            THRESHOLD: -15,      // Drop > 15 poin = critical
            SEVERITY: 'critical'
        },
        
        // 2. Below KKM Detection
        BELOW_KKM: {
            MIN_DATA: 2,
            KKM_VALUE: 60,       // Default KKM
            CONSECUTIVE_REQUIRED: 2,
            SEVERITY: 'high'
        },
        
        // 3. Declining Trend Detection
        DECLINING_TREND: {
            MIN_DATA: 3,
            THRESHOLD: -0.5,     // Slope < -0.5 = trend menurun
            SEVERITY_HIGH: -2.0, // Slope < -2.0 = severity high
            SEVERITY_MEDIUM: -1.0, // Slope < -1.0 = severity medium
        },
        
        // 4. Predicted Failure Detection
        PREDICTED_FAILURE: {
            MIN_DATA: 3,
            THRESHOLD: 60,       // Prediksi < 60 = akan gagal
            SEVERITY: 'high'
        },
        
        // 5. High Volatility Detection
        HIGH_VOLATILITY: {
            MIN_DATA: 4,
            THRESHOLD: 10,       // Std dev > 10 = volatilitas tinggi
            SEVERITY: 'medium'
        }
    },
    
    // Confidence Level Thresholds
    CONFIDENCE: {
        VERY_LOW: { min: 0, max: 2, label: 'Sangat Rendah', color: 'red' },
        LOW: { min: 3, max: 3, label: 'Rendah', color: 'yellow' },
        MEDIUM: { min: 4, max: 5, label: 'Sedang', color: 'blue' },
        HIGH: { min: 6, max: 8, label: 'Tinggi', color: 'green' },
        VERY_HIGH: { min: 9, max: Infinity, label: 'Sangat Tinggi', color: 'green' }
    },
    
    // Messages
    MESSAGES: {
        INSUFFICIENT_DATA: 'Data tidak cukup untuk analisis',
        VERY_LOW_CONFIDENCE: 'Confidence sangat rendah. Analisis lebih akurat setelah 3+ semester.',
        LOW_CONFIDENCE: 'Confidence rendah. Hasil lebih akurat dengan 4+ semester data.',
        MEDIUM_CONFIDENCE: 'Confidence sedang. Data cukup untuk analisis yang reliable.',
        HIGH_CONFIDENCE: 'Confidence tinggi. Data sangat cukup untuk analisis mendalam.',
        VERY_HIGH_CONFIDENCE: 'Confidence sangat tinggi. Data lengkap untuk analisis komprehensif.'
    }
};

module.exports = TIME_SERIES_CONFIG;
