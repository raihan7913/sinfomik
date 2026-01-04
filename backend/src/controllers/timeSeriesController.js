// backend/src/controllers/timeSeriesController.js
// Controller for Time Series Analysis and Early Warning System

const { getPool } = require('../config/db');
const { 
    analyzeTrend, 
    forecastNextSemester, 
    detectEarlyWarnings 
} = require('../utils/timeSeriesHelpers');

/**
 * Get time series analysis for a specific student
 * GET /api/timeseries/student/:id_siswa
 */
const getStudentTimeSeriesAnalysis = async (req, res) => {
    try {
        const { id_siswa } = req.params;
        const { id_mapel } = req.query; // Optional: specific subject
        
        const pool = getPool();
        
        // Get student info
        const studentResult = await pool.query(
            'SELECT id_siswa, nama_siswa FROM siswa WHERE id_siswa = $1',
            [id_siswa]
        );
        
        if (studentResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Siswa tidak ditemukan' 
            });
        }
        
        const student = studentResult.rows[0];
        
        // Build query for historical data
        let query = `
            SELECT 
                n.id_mapel,
                mp.nama_mapel,
                tas.tahun_ajaran,
                tas.semester,
                ROUND(AVG(n.nilai)::NUMERIC, 2) as nilai
            FROM nilai n
            JOIN matapelajaran mp ON n.id_mapel = mp.id_mapel
            JOIN tahunajaransemester tas ON n.id_ta_semester = tas.id_ta_semester
            WHERE n.id_siswa = $1
        `;
        
        const params = [id_siswa];
        
        if (id_mapel) {
            query += ' AND n.id_mapel = $2';
            params.push(id_mapel);
        }
        
        query += `
            GROUP BY n.id_mapel, mp.nama_mapel, tas.tahun_ajaran, tas.semester
            ORDER BY tas.tahun_ajaran, tas.semester
        `;
        
        const dataResult = await pool.query(query, params);
        
        if (dataResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tidak ada data nilai untuk siswa ini',
                student
            });
        }
        
        // Group data by subject
        const dataBySubject = {};
        dataResult.rows.forEach(row => {
            const key = row.id_mapel;
            if (!dataBySubject[key]) {
                dataBySubject[key] = {
                    id_mapel: row.id_mapel,
                    nama_mapel: row.nama_mapel,
                    data: []
                };
            }
            dataBySubject[key].data.push({
                tahun_ajaran: row.tahun_ajaran,
                semester: row.semester,
                nilai: parseFloat(row.nilai),
                period: `${row.tahun_ajaran} ${row.semester}`
            });
        });
        
        // Analyze each subject
        const analysis = [];
        
        for (const [id_mapel, subjectData] of Object.entries(dataBySubject)) {
            const { nama_mapel, data } = subjectData;
            
            // Trend Analysis
            const trendAnalysis = analyzeTrend(data);
            
            // Forecasting
            const forecast = forecastNextSemester(data);
            
            // Early Warning
            const warnings = detectEarlyWarnings(data, nama_mapel);
            
            analysis.push({
                id_mapel,
                nama_mapel,
                dataPoints: data.length,
                historicalData: data,
                trend: trendAnalysis,
                forecast,
                warnings
            });
        }
        
        res.json({
            success: true,
            student,
            analysis,
            totalSubjects: analysis.length
        });
        
    } catch (error) {
        console.error('Error in getStudentTimeSeriesAnalysis:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Terjadi kesalahan saat menganalisis data',
            error: error.message 
        });
    }
};

/**
 * Get early warning summary for a class (for wali kelas)
 * GET /api/timeseries/early-warning/class/:id_kelas
 */
const getClassEarlyWarnings = async (req, res) => {
    try {
        const { id_kelas } = req.params;
        const { tahun_ajaran, semester } = req.query;
        
        if (!tahun_ajaran || !semester) {
            return res.status(400).json({
                success: false,
                message: 'Parameter tahun_ajaran dan semester diperlukan'
            });
        }
        
        const pool = getPool();
        
        // Get class info
        const classResult = await pool.query(
            'SELECT id_kelas, nama_kelas FROM kelas WHERE id_kelas = $1',
            [id_kelas]
        );
        
        if (classResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Kelas tidak ditemukan'
            });
        }
        
        const classInfo = classResult.rows[0];
        
        // Get all students in the class
        const studentsResult = await pool.query(`
            SELECT DISTINCT s.id_siswa, s.nama_siswa
            FROM siswa s
            JOIN siswakelas sk ON s.id_siswa = sk.id_siswa
            JOIN tahunajaransemester tas ON sk.id_ta_semester = tas.id_ta_semester
            WHERE sk.id_kelas = $1 
                AND tas.tahun_ajaran = $2 
                AND tas.semester = $3
            ORDER BY s.nama_siswa
        `, [id_kelas, tahun_ajaran, semester]);
        
        if (studentsResult.rows.length === 0) {
            return res.json({
                success: true,
                classInfo,
                message: 'Tidak ada siswa di kelas ini',
                warnings: []
            });
        }
        
        const allWarnings = [];
        
        // Analyze each student
        for (const student of studentsResult.rows) {
            // Get historical data for all subjects
            const dataResult = await pool.query(`
                SELECT 
                    n.id_mapel,
                    mp.nama_mapel,
                    tas.tahun_ajaran,
                    tas.semester,
                    ROUND(AVG(n.nilai)::NUMERIC, 2) as nilai
                FROM nilai n
                JOIN matapelajaran mp ON n.id_mapel = mp.id_mapel
                JOIN tahunajaransemester tas ON n.id_ta_semester = tas.id_ta_semester
                WHERE n.id_siswa = $1
                GROUP BY n.id_mapel, mp.nama_mapel, tas.tahun_ajaran, tas.semester
                ORDER BY n.id_mapel, tas.tahun_ajaran, tas.semester
            `, [student.id_siswa]);
            
            if (dataResult.rows.length === 0) continue;
            
            // Group by subject
            const dataBySubject = {};
            dataResult.rows.forEach(row => {
                const key = row.id_mapel;
                if (!dataBySubject[key]) {
                    dataBySubject[key] = {
                        id_mapel: row.id_mapel,
                        nama_mapel: row.nama_mapel,
                        data: []
                    };
                }
                dataBySubject[key].data.push({
                    tahun_ajaran: row.tahun_ajaran,
                    semester: row.semester,
                    nilai: parseFloat(row.nilai),
                    period: `${row.tahun_ajaran} ${row.semester}`
                });
            });
            
            // Check warnings for each subject
            for (const [id_mapel, subjectData] of Object.entries(dataBySubject)) {
                const warningResult = detectEarlyWarnings(subjectData.data, subjectData.nama_mapel);
                
                if (!warningResult.error && warningResult.warnings.length > 0) {
                    allWarnings.push({
                        id_siswa: student.id_siswa,
                        nama_siswa: student.nama_siswa,
                        id_mapel,
                        nama_mapel: subjectData.nama_mapel,
                        warnings: warningResult.warnings,
                        dataPoints: warningResult.dataPoints,
                        history: subjectData.data.slice(-5) // Last 5 periods
                    });
                }
            }
        }
        
        // Group warnings by student (not by student+subject)
        const warningsByStudent = {};
        allWarnings.forEach(warning => {
            if (!warningsByStudent[warning.id_siswa]) {
                warningsByStudent[warning.id_siswa] = {
                    id_siswa: warning.id_siswa,
                    nama_siswa: warning.nama_siswa,
                    subjects: [],
                    highestSeverity: 'medium'
                };
            }
            
            warningsByStudent[warning.id_siswa].subjects.push({
                id_mapel: warning.id_mapel,
                nama_mapel: warning.nama_mapel,
                warnings: warning.warnings,
                dataPoints: warning.dataPoints,
                history: warning.history
            });
            
            // Determine highest severity for this student
            const hasCritical = warning.warnings.some(w => w.severity === 'critical');
            const hasHigh = warning.warnings.some(w => w.severity === 'high');
            
            if (hasCritical) {
                warningsByStudent[warning.id_siswa].highestSeverity = 'critical';
            } else if (hasHigh && warningsByStudent[warning.id_siswa].highestSeverity !== 'critical') {
                warningsByStudent[warning.id_siswa].highestSeverity = 'high';
            }
        });
        
        const studentsArray = Object.values(warningsByStudent);
        
        // Categorize students by their highest severity
        const critical = studentsArray.filter(s => s.highestSeverity === 'critical');
        const high = studentsArray.filter(s => s.highestSeverity === 'high');
        const medium = studentsArray.filter(s => s.highestSeverity === 'medium');
        
        res.json({
            success: true,
            classInfo,
            tahun_ajaran,
            semester,
            summary: {
                totalStudents: studentsResult.rows.length,
                studentsWithWarnings: studentsArray.length,
                criticalCount: critical.length,
                highCount: high.length,
                mediumCount: medium.length,
                totalWarnings: allWarnings.length
            },
            warnings: {
                critical,
                high,
                medium,
                all: studentsArray
            }
        });
        
    } catch (error) {
        console.error('Error in getClassEarlyWarnings:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan saat menganalisis early warning',
            error: error.message
        });
    }
};

/**
 * Get trend analysis summary for a class
 * GET /api/timeseries/trend/class/:id_kelas
 */
const getClassTrendSummary = async (req, res) => {
    try {
        const { id_kelas } = req.params;
        const { tahun_ajaran, semester } = req.query;
        
        if (!tahun_ajaran || !semester) {
            return res.status(400).json({
                success: false,
                message: 'Parameter tahun_ajaran dan semester diperlukan'
            });
        }
        
        const pool = getPool();
        
        // Get students in class
        const studentsResult = await pool.query(`
            SELECT DISTINCT s.id_siswa, s.nama_siswa
            FROM siswa s
            JOIN siswakelas sk ON s.id_siswa = sk.id_siswa
            JOIN tahunajaransemester tas ON sk.id_ta_semester = tas.id_ta_semester
            WHERE sk.id_kelas = $1 
                AND tas.tahun_ajaran = $2 
                AND tas.semester = $3
        `, [id_kelas, tahun_ajaran, semester]);
        
        const trendSummary = {
            improving: 0,      // trend naik
            stable: 0,         // trend stabil
            declining: 0,      // trend turun
            insufficient_data: 0
        };
        
        const studentDetails = [];
        
        for (const student of studentsResult.rows) {
            // Get all nilai for the student
            const dataResult = await pool.query(`
                SELECT 
                    tas.tahun_ajaran,
                    tas.semester,
                    ROUND(AVG(n.nilai)::NUMERIC, 2) as avg_nilai
                FROM nilai n
                JOIN tahunajaransemester tas ON n.id_ta_semester = tas.id_ta_semester
                WHERE n.id_siswa = $1
                GROUP BY tas.tahun_ajaran, tas.semester
                ORDER BY tas.tahun_ajaran, tas.semester
            `, [student.id_siswa]);
            
            if (dataResult.rows.length < 2) {
                trendSummary.insufficient_data++;
                continue;
            }
            
            const data = dataResult.rows.map(row => ({
                tahun_ajaran: row.tahun_ajaran,
                semester: row.semester,
                nilai: parseFloat(row.avg_nilai),
                period: `${row.tahun_ajaran} ${row.semester}`
            }));
            
            const trendAnalysis = analyzeTrend(data);
            
            if (trendAnalysis.error) {
                trendSummary.insufficient_data++;
            } else {
                const trendType = trendAnalysis.trend;
                if (trendType === 'naik_kuat' || trendType === 'naik_stabil') {
                    trendSummary.improving++;
                } else if (trendType === 'stabil') {
                    trendSummary.stable++;
                } else {
                    trendSummary.declining++;
                }
                
                studentDetails.push({
                    id_siswa: student.id_siswa,
                    nama_siswa: student.nama_siswa,
                    trend: trendAnalysis
                });
            }
        }
        
        res.json({
            success: true,
            summary: trendSummary,
            totalStudents: studentsResult.rows.length,
            students: studentDetails
        });
        
    } catch (error) {
        console.error('Error in getClassTrendSummary:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan saat menganalisis trend kelas',
            error: error.message
        });
    }
};

module.exports = {
    getStudentTimeSeriesAnalysis,
    getClassEarlyWarnings,
    getClassTrendSummary
};
