// backend/src/controllers/guruController.js
const { getDb } = require('../config/db');
const { format } = require('date-fns'); // For date formatting
const { createHash } = require('crypto'); // Untuk hashing SHA256
const bcrypt = require('bcryptjs'); // Untuk bcrypt hashing

// Helper untuk hashing password (sesuai dengan yang digunakan di Python)
function hashPasswordPythonStyle(password) {
    return createHash('sha256').update(password).digest('hex');
}

// Helper untuk hashing dengan bcrypt
async function hashPasswordBcrypt(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

// --- Get Teacher Assignments ---
exports.getGuruAssignments = (req, res) => {
    const { id_guru, id_ta_semester } = req.params;
    const db = getDb();
    db.all(`
        SELECT gmpk.id_kelas, k.nama_kelas, gmpk.id_mapel, mp.nama_mapel
        FROM gurumatapelajarankelas gmpk
        JOIN kelas k ON gmpk.id_kelas = k.id_kelas
        JOIN matapelajaran mp ON gmpk.id_mapel = mp.id_mapel
        WHERE gmpk.id_guru = ? AND gmpk.id_ta_semester = ?
        ORDER BY k.nama_kelas, mp.nama_mapel
    `, [id_guru, id_ta_semester], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

// --- Get Penugasan by Guru, Mapel, Kelas (using GuruMataPelajaranKelas as penugasan ID) ---
exports.getPenugasanByGuruMapelKelas = (req, res) => {
    const { id_guru, id_mapel, id_kelas, id_ta_semester } = req.params;
    const db = getDb();
    
    // Use combination as unique ID: guru-mapel-kelas-semester
    const id_penugasan = `${id_guru}-${id_mapel}-${id_kelas}-${id_ta_semester}`;
    
    db.get(`
        SELECT id_guru, id_mapel, id_kelas, id_ta_semester
        FROM gurumatapelajarankelas
        WHERE id_guru = ? AND id_mapel = ? AND id_kelas = ? AND id_ta_semester = ?
    `, [id_guru, id_mapel, id_kelas, id_ta_semester], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) {
            return res.status(404).json({ message: 'Penugasan tidak ditemukan' });
        }
        res.json({
            id_penugasan,
            id_guru,
            id_mapel,
            id_kelas,
            id_ta_semester
        });
    });
};

// --- Get Students in a Specific Class ---
exports.getStudentsInClass = (req, res) => {
    const { id_kelas, id_ta_semester } = req.params;
    const db = getDb();
    db.all(`
        SELECT s.id_siswa, s.nama_siswa
        FROM siswakelas sk
        JOIN siswa s ON sk.id_siswa = s.id_siswa
        WHERE sk.id_kelas = ? AND sk.id_ta_semester = ?
        ORDER BY s.nama_siswa
    `, [id_kelas, id_ta_semester], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

// --- Add or Update Grade (New Version for TP/UAS Structure) ---
exports.addOrUpdateNewGrade = (req, res) => {
    const { id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp, nilai, keterangan } = req.body;
    const db = getDb();
    const tanggal_input = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

    // Validate input
    if (!['TP', 'UAS'].includes(jenis_nilai)) {
        return res.status(400).json({ message: 'Jenis nilai harus TP atau UAS' });
    }

    if (jenis_nilai === 'TP' && !urutan_tp) {
        return res.status(400).json({ message: 'Urutan TP diperlukan untuk jenis nilai TP' });
    }

    // Check if grade already exists
    const checkQuery = jenis_nilai === 'TP' 
        ? `SELECT id_nilai FROM nilai 
           WHERE id_siswa = ? AND id_guru = ? AND id_mapel = ? AND id_kelas = ?
           AND id_ta_semester = ? AND jenis_nilai = ? AND urutan_tp = ?`
        : `SELECT id_nilai FROM nilai 
           WHERE id_siswa = ? AND id_guru = ? AND id_mapel = ? AND id_kelas = ?
           AND id_ta_semester = ? AND jenis_nilai = ?`;

    const checkParams = jenis_nilai === 'TP' 
        ? [id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp]
        : [id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai];

    db.get(checkQuery, checkParams, (err, row) => {
        if (err) return res.status(500).json({ message: err.message });

        if (row) {
            // Update if already exists
            db.run(`
                UPDATE nilai SET nilai = ?, keterangan = ?, tanggal_input = ?
                WHERE id_nilai = ?
            `, [nilai, keterangan, tanggal_input, row.id_nilai], function(err) {
                if (err) return res.status(400).json({ message: err.message });
                res.status(200).json({ message: 'Nilai berhasil diperbarui.', id: row.id_nilai, changes: this.changes });
            });
        } else {
            // Insert if not exists
            db.run(`
                INSERT INTO nilai (id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp, nilai, tanggal_input, keterangan)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [id_siswa, id_guru, id_mapel, id_kelas, id_ta_semester, jenis_nilai, urutan_tp, nilai, tanggal_input, keterangan], function(err) {
                if (err) return res.status(400).json({ message: err.message });
                res.status(201).json({ message: 'Nilai berhasil ditambahkan.', id: this.lastID });
            });
        }
    });
};

// --- Get Grades by Assignment (New Version for TP/UAS Structure) ---
exports.getGradesByAssignment = (req, res) => {
    const { id_guru, id_mapel, id_kelas, id_ta_semester } = req.params;
    const db = getDb();
    
    db.all(`
        SELECT
            n.id_nilai,
            n.id_siswa,
            s.nama_siswa,
            n.jenis_nilai,
            n.urutan_tp,
            n.nilai,
            n.tanggal_input,
            n.keterangan
        FROM nilai n
        JOIN siswa s ON n.id_siswa = s.id_siswa
        WHERE n.id_guru = ? AND n.id_mapel = ? AND n.id_kelas = ? AND n.id_ta_semester = ?
        ORDER BY s.nama_siswa, n.jenis_nilai, n.urutan_tp
    `, [id_guru, id_mapel, id_kelas, id_ta_semester], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

// --- Grade Recap (Updated for new structure) ---
exports.getRekapNilai = (req, res) => {
    const { id_guru, id_mapel, id_kelas, id_ta_semester } = req.params;
    const db = getDb();
    
    db.all(`
        SELECT
            s.id_siswa,
            s.nama_siswa,
            n.jenis_nilai,
            n.urutan_tp,
            n.nilai,
            n.tanggal_input,
            n.keterangan
        FROM nilai n
        JOIN siswa s ON n.id_siswa = s.id_siswa
        WHERE n.id_guru = ? AND n.id_mapel = ? AND n.id_kelas = ? AND n.id_ta_semester = ?
        ORDER BY s.nama_siswa, n.jenis_nilai, n.urutan_tp
    `, [id_guru, id_mapel, id_kelas, id_ta_semester], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

// --- Learning Outcomes (CP) for Teachers ---
exports.getCapaianPembelajaranByMapel = (req, res) => {
    const { id_mapel } = req.params;
    const db = getDb();
    db.all(`
        SELECT id_cp, fase, deskripsi_cp
        FROM capaianpembelajaran
        WHERE id_mapel = ?
        ORDER BY fase
    `, [id_mapel], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.getSiswaCapaianPembelajaran = (req, res) => {
    const { id_guru, id_mapel, id_kelas, id_ta_semester } = req.params;
    const db = getDb();

    // Query to get all students in that class
    // and their learning outcome status for CPs related to that subject
    db.all(`
        SELECT
            s.id_siswa,
            s.nama_siswa,
            cp.id_cp,
            cp.fase,
            cp.deskripsi_cp,
            scp.status_capaian,
            scp.tanggal_penilaian,
            scp.catatan
        FROM siswakelas sk
        JOIN siswa s ON sk.id_siswa = s.id_siswa
        JOIN gurumatapelajarankelas gmpk ON
            gmpk.id_kelas = sk.id_kelas AND gmpk.id_mapel = ? AND gmpk.id_guru = ? AND gmpk.id_ta_semester = sk.id_ta_semester
        LEFT JOIN capaianpembelajaran cp ON cp.id_mapel = gmpk.id_mapel
        LEFT JOIN siswacapaianpembelajaran scp ON
            scp.id_siswa = s.id_siswa AND scp.id_cp = cp.id_cp AND scp.id_ta_semester = ?
        WHERE sk.id_kelas = ? AND sk.id_ta_semester = ?
        ORDER BY s.nama_siswa, cp.fase
    `, [id_mapel, id_guru, id_ta_semester, id_kelas, id_ta_semester], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.addOrUpdateSiswaCapaianPembelajaran = (req, res) => {
    const { id_siswa, id_cp, id_guru, id_ta_semester, status_capaian, catatan } = req.body;
    const db = getDb();
    const tanggal_penilaian = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

    // Check if SiswaCapaianPembelajaran data already exists
    db.get(`
        SELECT id_siswa_cp FROM siswacapaianpembelajaran
        WHERE id_siswa = ? AND id_cp = ? AND id_ta_semester = ?
    `, [id_siswa, id_cp, id_ta_semester], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });

        if (row) {
            // Update if already exists
            db.run(`
                UPDATE siswacapaianpembelajaran SET status_capaian = ?, catatan = ?, tanggal_penilaian = ?
                WHERE id_siswa_cp = ?
            `, [status_capaian, catatan, tanggal_penilaian, row.id_siswa_cp], function(err) {
                if (err) return res.status(400).json({ message: err.message });
                res.status(200).json({ message: 'Capaian Pembelajaran siswa berhasil diperbarui.', id: row.id_siswa_cp, changes: this.changes });
            });
        } else {
            // Insert if not exists
            db.run(`
                INSERT INTO siswacapaianpembelajaran (id_siswa, id_cp, id_guru, id_ta_semester, status_capaian, tanggal_penilaian, catatan)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [id_siswa, id_cp, id_guru, id_ta_semester, status_capaian, tanggal_penilaian, catatan], function(err) {
                if (err) return res.status(400).json({ message: err.message });
                res.status(201).json({ message: 'Capaian Pembelajaran siswa berhasil ditambahkan.', id: this.lastID });
            });
        }
    });
};

// --- New: Get all grades for a class where the teacher is a homeroom teacher (wali kelas) ---
exports.getWaliKelasGrades = (req, res) => {
    const { id_guru, id_ta_semester } = req.params;
    const { id_kelas } = req.query; // Optional: specific class filter
    const db = getDb();

    // First, find the class(es) where this guru is the homeroom teacher for the given semester
    let kelasQuery = `SELECT id_kelas, nama_kelas FROM kelas WHERE id_wali_kelas = ? AND id_ta_semester = ?`;
    let kelasParams = [id_guru, id_ta_semester];
    
    // If specific class is requested, add filter
    if (id_kelas) {
        kelasQuery += ` AND id_kelas = ?`;
        kelasParams.push(id_kelas);
    }
    
    kelasQuery += ` ORDER BY nama_kelas LIMIT 1`; // Get first class if multiple

    db.get(kelasQuery, kelasParams, (err, kelas) => {
            if (err) {
                console.error("Error finding wali kelas class:", err.message);
                return res.status(500).json({ message: err.message });
            }
            if (!kelas) {
                return res.status(404).json({ message: 'Guru ini bukan wali kelas untuk semester yang dipilih atau kelas tidak ditemukan.' });
            }

            // If class found, fetch all grades for students in that class
            const query = `
                SELECT
                    s.id_siswa,
                    s.nama_siswa,
                    mp.nama_mapel,
                    n.jenis_nilai,
                    n.urutan_tp,
                    n.nilai,
                    n.tanggal_input,
                    n.keterangan
                FROM siswakelas sk
                JOIN siswa s ON sk.id_siswa = s.id_siswa
                LEFT JOIN nilai n ON s.id_siswa = n.id_siswa AND sk.id_kelas = n.id_kelas AND sk.id_ta_semester = n.id_ta_semester
                LEFT JOIN matapelajaran mp ON n.id_mapel = mp.id_mapel
                WHERE sk.id_kelas = ? AND sk.id_ta_semester = ?
                ORDER BY s.nama_siswa, mp.nama_mapel, n.jenis_nilai, n.urutan_tp;
            `;

            db.all(query, [kelas.id_kelas, id_ta_semester], (err, rows) => {
                if (err) {
                    console.error("Error fetching wali kelas grades:", err.message);
                    return res.status(500).json({ message: err.message });
                }
                
                // Ensure students without grades are still included
                // If no grades at all, create at least one row per student with null values
                if (rows.length === 0) {
                    // Fetch all students in the class
                    db.all(`
                        SELECT s.id_siswa, s.nama_siswa
                        FROM siswakelas sk
                        JOIN siswa s ON sk.id_siswa = s.id_siswa
                        WHERE sk.id_kelas = ? AND sk.id_ta_semester = ?
                        ORDER BY s.nama_siswa
                    `, [kelas.id_kelas, id_ta_semester], (err2, students) => {
                        if (err2) {
                            console.error("Error fetching students:", err2.message);
                            return res.status(500).json({ message: err2.message });
                        }
                        
                        // Return students with null grade data
                        const studentsWithoutGrades = students.map(s => ({
                            id_siswa: s.id_siswa,
                            nama_siswa: s.nama_siswa,
                            nama_mapel: null,
                            jenis_nilai: null,
                            urutan_tp: null,
                            nilai: null,
                            tanggal_input: null,
                            keterangan: null
                        }));
                        
                        res.json({
                            classInfo: { id_kelas: kelas.id_kelas, nama_kelas: kelas.nama_kelas },
                            grades: studentsWithoutGrades
                        });
                    });
                } else {
                    res.json({
                        classInfo: { id_kelas: kelas.id_kelas, nama_kelas: kelas.nama_kelas },
                        grades: rows
                    });
                }
            });
        });
};

// Get list of classes where this guru is wali kelas
exports.getWaliKelasClassList = (req, res) => {
    const { id_guru, id_ta_semester } = req.params;
    const db = getDb();

    db.all(`
        SELECT 
            k.id_kelas, 
            k.nama_kelas,
            tas.tahun_ajaran,
            tas.semester,
            COUNT(DISTINCT sk.id_siswa) as jumlah_siswa
        FROM kelas k
        JOIN TahunAjaranSemester tas ON k.id_ta_semester = tas.id_ta_semester
        LEFT JOIN siswakelas sk ON k.id_kelas = sk.id_kelas AND k.id_ta_semester = sk.id_ta_semester
        WHERE k.id_wali_kelas = ? AND k.id_ta_semester = ?
        GROUP BY k.id_kelas, k.nama_kelas, tas.tahun_ajaran, tas.semester
        ORDER BY k.nama_kelas
    `, [id_guru, id_ta_semester], (err, rows) => {
        if (err) {
            console.error("Error fetching wali kelas class list:", err.message);
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
};

// --- Change Password untuk Guru ---
exports.changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const id_guru = req.user.id; // Dari JWT token (field 'id', bukan 'id_guru')
    
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Password lama dan password baru harus diisi' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password baru minimal 6 karakter' });
    }
    
    const db = getDb();
    
    // Ambil data guru untuk cek password
    db.get('SELECT * FROM guru WHERE id_guru = ?', [id_guru], async (err, guru) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        
        if (!guru) {
            return res.status(404).json({ message: 'Guru tidak ditemukan' });
        }
        
        // Verifikasi password lama - support both SHA256 and bcrypt
        let isPasswordValid = false;
        
        if (guru.password_hash.startsWith('$2a$') || guru.password_hash.startsWith('$2b$')) {
            // Password di-hash dengan bcrypt
            isPasswordValid = await bcrypt.compare(oldPassword, guru.password_hash);
        } else {
            // Password di-hash dengan SHA256 (legacy)
            const hashedOldPassword = hashPasswordPythonStyle(oldPassword);
            isPasswordValid = hashedOldPassword === guru.password_hash;
        }
        
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Password lama tidak sesuai' });
        }
        
        // Hash password baru dengan bcrypt (lebih aman)
        const hashedNewPassword = await hashPasswordBcrypt(newPassword);
        
        // Update password
        db.run('UPDATE guru SET password_hash = ? WHERE id_guru = ?', [hashedNewPassword, id_guru], function(err) {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.json({ message: 'Password berhasil diubah' });
        });
    });
};

// --- Manual TP Management ---

// Get manual TP by assignment
exports.getManualTp = (req, res) => {
    const { id_penugasan, id_ta_semester } = req.params;
    const db = getDb();
    
    db.all(`
        SELECT id_manual_tp, tp_number, tp_name, created_at
        FROM manual_tp
        WHERE id_penugasan = ? AND id_ta_semester = ?
        ORDER BY tp_number
    `, [id_penugasan, id_ta_semester], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ success: true, manual_tp: rows || [] });
    });
};

// Add manual TP
exports.addManualTp = (req, res) => {
    const { id_penugasan, id_ta_semester, tp_number, tp_name } = req.body;
    const db = getDb();
    
    if (!id_penugasan || !id_ta_semester || !tp_number || !tp_name) {
        return res.status(400).json({ 
            success: false, 
            message: 'id_penugasan, id_ta_semester, tp_number, dan tp_name harus diisi' 
        });
    }
    
    db.run(`
        INSERT INTO manual_tp (id_penugasan, id_ta_semester, tp_number, tp_name)
        VALUES (?, ?, ?, ?)
    `, [id_penugasan, id_ta_semester, tp_number, tp_name], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint')) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'TP dengan nomor tersebut sudah ada' 
                });
            }
            return res.status(500).json({ success: false, message: err.message });
        }
        res.status(201).json({ 
            success: true, 
            message: 'TP manual berhasil ditambahkan',
            id_manual_tp: this.lastID 
        });
    });
};

// Delete manual TP
exports.deleteManualTp = (req, res) => {
    const { id_manual_tp } = req.params;
    const db = getDb();
    
    db.run(`
        DELETE FROM manual_tp WHERE id_manual_tp = ?
    `, [id_manual_tp], function(err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'TP manual tidak ditemukan' });
        }
        res.json({ success: true, message: 'TP manual berhasil dihapus' });
    });
};
