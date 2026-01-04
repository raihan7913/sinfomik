// backend/src/routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const timeSeriesController = require('../controllers/timeSeriesController');
const { verifyToken, isAdminOrGuru } = require('../middlewares/authMiddleware');

/**
 * ANALYTICS ROUTES
 * Base path: /api/analytics
 * All analytics routes require authentication
 */

// Apply auth middleware to all analytics routes
router.use(verifyToken);
router.use(isAdminOrGuru);

// School-wide analytics
// GET /api/analytics/school?id_mapel=1&id_ta_semester=2
router.get('/school', analyticsController.getSchoolAnalytics);

// Angkatan analytics (ADMIN & GURU)
// GET /api/analytics/angkatan (accepts query param tahun_ajaran_masuk)
router.get('/angkatan', analyticsController.getAngkatanAnalytics);
// Backwards-compatible route: GET /api/analytics/angkatan/:tahun_ajaran_masuk
router.get('/angkatan/:tahun_ajaran_masuk', analyticsController.getAngkatanAnalytics);

// Get list of available angkatan
// GET /api/analytics/angkatan-list
router.get('/angkatan-list', analyticsController.getAngkatanList);

// Student individual analytics (ADMIN & GURU)
// GET /api/analytics/student/:id_siswa?id_mapel=1
router.get('/student/:id_siswa', analyticsController.getStudentAnalytics);

// Student mapel detail (per-TP) - GET /api/analytics/student/:id_siswa/mapel/:id_mapel/details
router.get('/student/:id_siswa/mapel/:id_mapel/details', analyticsController.getStudentMapelDetails);

// Guru subject analytics (GURU - own data)
// GET /api/analytics/guru/:id_guru?id_mapel=1&id_kelas=2&id_ta_semester=3
router.get('/guru/:id_guru', analyticsController.getGuruAnalytics);

// Compare multiple students (ADMIN & GURU)
// GET /api/analytics/compare-students?id_siswa_list=1001,1002,1003&id_mapel=1
router.get('/compare-students', analyticsController.compareStudents);

// ========================================
// TIME SERIES ANALYSIS ROUTES
// ========================================

// Get time series analysis for a specific student
// GET /api/analytics/timeseries/student/:id_siswa?id_mapel=1 (optional: filter by subject)
router.get('/timeseries/student/:id_siswa', timeSeriesController.getStudentTimeSeriesAnalysis);

// Get early warnings for a class (for wali kelas)
// GET /api/analytics/timeseries/early-warning/class/:id_kelas?tahun_ajaran=2024/2025&semester=Ganjil
router.get('/timeseries/early-warning/class/:id_kelas', timeSeriesController.getClassEarlyWarnings);

// Get trend summary for a class
// GET /api/analytics/timeseries/trend/class/:id_kelas?tahun_ajaran=2024/2025&semester=Ganjil
router.get('/timeseries/trend/class/:id_kelas', timeSeriesController.getClassTrendSummary);

module.exports = router;
