// backend/src/utils/timeSeriesHelpers.js
// Time Series Analysis Helper Functions

const TIME_SERIES_CONFIG = require('../config/timeSeriesConfig');

/**
 * Get confidence level based on data length
 */
function getConfidenceLevel(dataLength) {
    const { CONFIDENCE } = TIME_SERIES_CONFIG;
    
    for (const [level, config] of Object.entries(CONFIDENCE)) {
        if (dataLength >= config.min && dataLength <= config.max) {
            return {
                level: level.toLowerCase().replace('_', ' '),
                label: config.label,
                color: config.color,
                dataPoints: dataLength
            };
        }
    }
    
    return {
        level: 'unknown',
        label: 'Unknown',
        color: 'gray',
        dataPoints: dataLength
    };
}

/**
 * Get confidence message based on data length
 */
function getConfidenceMessage(dataLength) {
    const { MESSAGES } = TIME_SERIES_CONFIG;
    
    if (dataLength < 2) return MESSAGES.INSUFFICIENT_DATA;
    if (dataLength === 2) return MESSAGES.VERY_LOW_CONFIDENCE;
    if (dataLength === 3) return MESSAGES.LOW_CONFIDENCE;
    if (dataLength >= 4 && dataLength <= 5) return MESSAGES.MEDIUM_CONFIDENCE;
    if (dataLength >= 6 && dataLength <= 8) return MESSAGES.HIGH_CONFIDENCE;
    return MESSAGES.VERY_HIGH_CONFIDENCE;
}

/**
 * Calculate linear regression for trend analysis
 */
function calculateLinearRegression(data) {
    const n = data.length;
    
    if (n < 2) {
        return { slope: 0, intercept: 0, rSquared: 0 };
    }
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    
    data.forEach((item, idx) => {
        const x = idx;
        const y = parseFloat(item.nilai) || 0;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
        sumY2 += y * y;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R² (coefficient of determination)
    const meanY = sumY / n;
    const ssTotal = data.reduce((sum, item) => {
        const y = parseFloat(item.nilai) || 0;
        return sum + Math.pow(y - meanY, 2);
    }, 0);
    
    const ssResidual = data.reduce((sum, item, idx) => {
        const y = parseFloat(item.nilai) || 0;
        const predicted = slope * idx + intercept;
        return sum + Math.pow(y - predicted, 2);
    }, 0);
    
    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
    
    return {
        slope: parseFloat(slope.toFixed(3)),
        intercept: parseFloat(intercept.toFixed(2)),
        rSquared: parseFloat(rSquared.toFixed(3))
    };
}

/**
 * Determine trend category based on slope
 */
function determineTrend(slope) {
    const { TREND_ANALYSIS } = TIME_SERIES_CONFIG;
    
    if (slope > TREND_ANALYSIS.STRONG_INCREASE) return 'naik_kuat';
    if (slope > TREND_ANALYSIS.MODERATE_INCREASE) return 'naik_stabil';
    if (slope >= -TREND_ANALYSIS.STABLE_RANGE) return 'stabil';
    if (slope >= TREND_ANALYSIS.MODERATE_DECREASE) return 'turun_perlahan';
    return 'turun_signifikan';
}

/**
 * Get trend interpretation text
 */
function getTrendInterpretation(slope, dataPoints) {
    const trendType = determineTrend(slope);
    const absSlope = Math.abs(slope);
    
    const interpretations = {
        naik_kuat: `Peningkatan sangat baik (+${slope.toFixed(1)} poin per semester)`,
        naik_stabil: `Peningkatan konsisten (+${slope.toFixed(1)} poin per semester)`,
        stabil: `Performa stabil (${slope >= 0 ? '+' : ''}${slope.toFixed(1)} poin per semester)`,
        turun_perlahan: `Penurunan ringan (${slope.toFixed(1)} poin per semester) - perlu perhatian`,
        turun_signifikan: `Penurunan signifikan (${slope.toFixed(1)} poin per semester) - butuh intervensi`
    };
    
    let base = interpretations[trendType];
    
    // Add context based on data points
    if (dataPoints >= 6) {
        base += '. Pola terlihat jelas dalam jangka panjang.';
    } else if (dataPoints >= 4) {
        base += '. Pola mulai terlihat konsisten.';
    } else if (dataPoints >= 3) {
        base += '. Pantau perkembangan di semester berikutnya.';
    } else {
        base += '. Data masih sangat terbatas.';
    }
    
    return base;
}

/**
 * Analyze trend from historical data
 */
function analyzeTrend(historicalData) {
    const dataLength = historicalData.length;
    const { TREND_ANALYSIS } = TIME_SERIES_CONFIG;
    
    // Check if data is sufficient
    if (dataLength < TREND_ANALYSIS.ABSOLUTE_MIN) {
        return {
            error: true,
            errorType: 'insufficient_data',
            message: 'Tidak dapat menganalisis trend. Butuh minimal 2 semester data.',
            dataPoints: dataLength,
            requiredPoints: TREND_ANALYSIS.ABSOLUTE_MIN,
            trend: null,
            confidence: null
        };
    }
    
    // Calculate regression
    const { slope, intercept, rSquared } = calculateLinearRegression(historicalData);
    const trendType = determineTrend(slope);
    const confidence = getConfidenceLevel(dataLength);
    
    // Determine if warning should be shown
    const showWarning = dataLength < TREND_ANALYSIS.PRACTICAL_MIN;
    
    return {
        error: false,
        dataPoints: dataLength,
        trend: trendType,
        slope,
        intercept,
        rSquared,
        confidence: confidence.level,
        confidenceLabel: confidence.label,
        confidenceColor: confidence.color,
        confidenceMessage: getConfidenceMessage(dataLength),
        interpretation: getTrendInterpretation(slope, dataLength),
        showWarning,
        warningMessage: showWarning ? `Data masih terbatas (${dataLength} semester). Analisis lebih akurat dengan ${TREND_ANALYSIS.PRACTICAL_MIN}+ semester data.` : null
    };
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(data) {
    const n = data.length;
    if (n < 2) return 0;
    
    const values = data.map(d => parseFloat(d.nilai) || 0);
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    
    return Math.sqrt(variance);
}

/**
 * Forecast next semester value
 */
function forecastNextSemester(historicalData) {
    const dataLength = historicalData.length;
    const { TREND_ANALYSIS } = TIME_SERIES_CONFIG;
    
    if (dataLength < TREND_ANALYSIS.PRACTICAL_MIN) {
        return {
            error: true,
            message: `Butuh minimal ${TREND_ANALYSIS.PRACTICAL_MIN} semester data untuk prediksi yang reliable`,
            dataPoints: dataLength,
            requiredPoints: TREND_ANALYSIS.PRACTICAL_MIN,
            forecast: null
        };
    }
    
    const { slope, intercept } = calculateLinearRegression(historicalData);
    const nextIndex = dataLength;
    const forecast = slope * nextIndex + intercept;
    
    // Clamp between 0-100
    const clampedForecast = Math.max(0, Math.min(100, forecast));
    
    // Calculate confidence interval
    const stdDev = calculateStdDev(historicalData);
    const confidenceUpper = Math.min(100, clampedForecast + stdDev);
    const confidenceLower = Math.max(0, clampedForecast - stdDev);
    
    const confidence = getConfidenceLevel(dataLength);
    
    return {
        error: false,
        dataPoints: dataLength,
        forecast: parseFloat(clampedForecast.toFixed(2)),
        confidenceUpper: parseFloat(confidenceUpper.toFixed(2)),
        confidenceLower: parseFloat(confidenceLower.toFixed(2)),
        confidenceRange: parseFloat(stdDev.toFixed(2)),
        confidence: confidence.level,
        confidenceLabel: confidence.label,
        confidenceMessage: getConfidenceMessage(dataLength),
        method: 'Linear Regression'
    };
}

/**
 * Detect early warnings
 */
function detectEarlyWarnings(historicalData, mapelName = '') {
    const dataLength = historicalData.length;
    const warnings = [];
    const { EARLY_WARNING } = TIME_SERIES_CONFIG;
    
    // Check minimum data
    if (dataLength < 2) {
        return {
            error: true,
            message: 'Butuh minimal 2 semester data untuk deteksi early warning',
            dataPoints: dataLength,
            requiredPoints: 2,
            warnings: []
        };
    }
    
    // 1. SUDDEN DROP DETECTION (Min: 2 data)
    if (dataLength >= EARLY_WARNING.SUDDEN_DROP.MIN_DATA) {
        const lastValue = parseFloat(historicalData[dataLength - 1].nilai) || 0;
        const prevValue = parseFloat(historicalData[dataLength - 2].nilai) || 0;
        const change = lastValue - prevValue;
        
        if (change <= EARLY_WARNING.SUDDEN_DROP.THRESHOLD) {
            warnings.push({
                type: 'sudden_drop',
                severity: EARLY_WARNING.SUDDEN_DROP.SEVERITY,
                priority: 0,
                message: `Penurunan drastis ${Math.abs(change).toFixed(1)} poin di semester terakhir`,
                detail: `${prevValue} → ${lastValue}`,
                recommendation: 'SEGERA: Konsultasi dengan siswa, orang tua, dan guru mata pelajaran. Identifikasi penyebab penurunan.',
                icon: '📉',
                mapel: mapelName
            });
        }
    }
    
    // 2. BELOW KKM DETECTION (Min: 2 data)
    if (dataLength >= EARLY_WARNING.BELOW_KKM.MIN_DATA) {
        const kkm = EARLY_WARNING.BELOW_KKM.KKM_VALUE;
        let consecutiveBelow = 0;
        
        for (let i = dataLength - 1; i >= 0; i--) {
            const nilai = parseFloat(historicalData[i].nilai) || 0;
            if (nilai < kkm) {
                consecutiveBelow++;
            } else {
                break;
            }
        }
        
        if (consecutiveBelow >= EARLY_WARNING.BELOW_KKM.CONSECUTIVE_REQUIRED) {
            warnings.push({
                type: 'below_kkm',
                severity: EARLY_WARNING.BELOW_KKM.SEVERITY,
                priority: 1,
                message: `Nilai di bawah KKM (${kkm}) selama ${consecutiveBelow} semester berturut-turut`,
                detail: `KKM: ${kkm}`,
                recommendation: 'Perlukan remedial dan bimbingan intensif. Evaluasi metode pembelajaran.',
                icon: '❌',
                mapel: mapelName
            });
        }
    }
    
    // 3. DECLINING TREND DETECTION (Min: 3 data)
    if (dataLength >= EARLY_WARNING.DECLINING_TREND.MIN_DATA) {
        const { slope } = calculateLinearRegression(historicalData);
        
        if (slope <= EARLY_WARNING.DECLINING_TREND.THRESHOLD) {
            let severity = 'low';
            if (slope <= EARLY_WARNING.DECLINING_TREND.SEVERITY_HIGH) {
                severity = 'high';
            } else if (slope <= EARLY_WARNING.DECLINING_TREND.SEVERITY_MEDIUM) {
                severity = 'medium';
            }
            
            warnings.push({
                type: 'declining_trend',
                severity,
                priority: severity === 'high' ? 1 : 2,
                message: `Penurunan konsisten: ${Math.abs(slope).toFixed(1)} poin per semester`,
                detail: `Trend slope: ${slope.toFixed(2)}`,
                recommendation: getTrendRecommendation(slope),
                icon: '⬇️',
                mapel: mapelName
            });
        }
    }
    
    // 4. PREDICTED FAILURE DETECTION (Min: 3 data)
    if (dataLength >= EARLY_WARNING.PREDICTED_FAILURE.MIN_DATA) {
        const forecast = forecastNextSemester(historicalData);
        
        if (!forecast.error && forecast.forecast < EARLY_WARNING.PREDICTED_FAILURE.THRESHOLD) {
            warnings.push({
                type: 'predicted_failure',
                severity: EARLY_WARNING.PREDICTED_FAILURE.SEVERITY,
                priority: 1,
                message: `Prediksi nilai semester depan: ${forecast.forecast} (di bawah KKM)`,
                detail: `Confidence: ${forecast.confidenceLabel}`,
                recommendation: 'Intervensi preventif diperlukan sebelum semester depan. Buat program bimbingan khusus.',
                icon: '⚠️',
                mapel: mapelName
            });
        }
    }
    
    // 5. HIGH VOLATILITY DETECTION (Min: 4 data)
    if (dataLength >= EARLY_WARNING.HIGH_VOLATILITY.MIN_DATA) {
        const volatility = calculateStdDev(historicalData);
        
        if (volatility > EARLY_WARNING.HIGH_VOLATILITY.THRESHOLD) {
            warnings.push({
                type: 'high_volatility',
                severity: EARLY_WARNING.HIGH_VOLATILITY.SEVERITY,
                priority: 3,
                message: `Performa sangat tidak konsisten (volatilitas: ${volatility.toFixed(1)})`,
                detail: `Standard Deviation: ${volatility.toFixed(2)}`,
                recommendation: 'Evaluasi stabilitas lingkungan belajar dan metode belajar siswa.',
                icon: '⚡',
                mapel: mapelName
            });
        }
    }
    
    // Sort by priority
    warnings.sort((a, b) => a.priority - b.priority);
    
    return {
        error: false,
        dataPoints: dataLength,
        warnings,
        warningCount: warnings.length,
        hasCritical: warnings.some(w => w.severity === 'critical'),
        hasHigh: warnings.some(w => w.severity === 'high')
    };
}

/**
 * Get trend recommendation based on slope
 */
function getTrendRecommendation(slope) {
    if (slope < -3) return 'URGENT: Intervensi intensif diperlukan. Konsultasi dengan kepala sekolah dan orang tua.';
    if (slope < -2) return 'Butuh perhatian serius. Buat program bimbingan khusus dan pantau ketat.';
    if (slope < -1) return 'Pantau ketat dan berikan dukungan tambahan. Identifikasi kesulitan belajar.';
    return 'Monitor perkembangan di semester berikutnya dan berikan dukungan sesuai kebutuhan.';
}

module.exports = {
    analyzeTrend,
    forecastNextSemester,
    detectEarlyWarnings,
    calculateLinearRegression,
    calculateStdDev,
    getConfidenceLevel,
    getConfidenceMessage
};
